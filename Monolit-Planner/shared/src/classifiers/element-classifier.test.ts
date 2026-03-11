/**
 * Element Classifier Tests
 */
import { describe, it, expect } from 'vitest';
import {
  classifyElement,
  getElementProfile,
  recommendFormwork,
  getAdjustedAssemblyNorm,
  estimateRebarMass,
  getAllElementTypes,
} from './element-classifier.js';

describe('Element Classifier', () => {
  // ─── classifyElement ─────────────────────────────────────────────────

  describe('classifyElement', () => {
    it('classifies foundation by keyword', () => {
      const result = classifyElement('ZÁKLADY PILÍŘŮ');
      expect(result.element_type).toBe('zaklady_piliru');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('classifies bridge deck', () => {
      const result = classifyElement('Mostovková deska');
      expect(result.element_type).toBe('mostovkova_deska');
    });

    it('classifies cornice', () => {
      const result = classifyElement('ŘÍMSOVÁ DESKA');
      expect(result.element_type).toBe('rimsa');
    });

    it('classifies pier shaft', () => {
      const result = classifyElement('Dříky pilířů P1-P4');
      expect(result.element_type).toBe('driky_piliru');
    });

    it('classifies retaining wall', () => {
      const result = classifyElement('Opěrná stěna levá');
      expect(result.element_type).toBe('operne_zdi');
    });

    it('classifies columns/pilíře', () => {
      const result = classifyElement('SLOUPY 1.NP');
      expect(result.element_type).toBe('driky_piliru');
    });

    it('classifies closure joints', () => {
      const result = classifyElement('Závěrné zídky');
      expect(result.element_type).toBe('mostni_zavirne_zidky');
    });

    it('classifies abutments', () => {
      const result = classifyElement('OPĚRY A ÚLOŽNÉ PRAHY');
      expect(result.element_type).toBe('opery_ulozne_prahy');
    });

    it('classifies nosná konstrukce as deck', () => {
      const result = classifyElement('NOSNÁ KONSTRUKCE MOSTU');
      expect(result.element_type).toBe('mostovkova_deska');
    });

    it('returns other for unknown input', () => {
      const result = classifyElement('XYZ neznámý prvek');
      expect(result.element_type).toBe('other');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('handles diacritics-insensitive matching', () => {
      const result = classifyElement('ZAKLADY PILIRU');
      expect(result.element_type).toBe('zaklady_piliru');
    });

    it('handles lowercase', () => {
      const result = classifyElement('mostovka');
      expect(result.element_type).toBe('mostovkova_deska');
    });

    it('classifies bridge deck from common alternate naming', () => {
      const result = classifyElement('MOSTNÍ DESKA - levý most');
      expect(result.element_type).toBe('mostovkova_deska');
    });

    it('classifies mixed-language bridge deck naming', () => {
      const result = classifyElement('Bridge deck / пролетное строение');
      expect(result.element_type).toBe('mostovkova_deska');
    });
  });

  // ─── getElementProfile ───────────────────────────────────────────────

  describe('getElementProfile', () => {
    it('returns full profile for known type', () => {
      const profile = getElementProfile('mostovkova_deska');
      expect(profile.element_type).toBe('mostovkova_deska');
      expect(profile.confidence).toBe(1.0);
      expect(profile.needs_supports).toBe(true);
      expect(profile.needs_crane).toBe(true);
      expect(profile.strip_strength_pct).toBe(70);
      expect(profile.orientation).toBe('horizontal');
    });

    it('vertical elements have lower strip strength requirement', () => {
      const wall = getElementProfile('operne_zdi');
      const deck = getElementProfile('mostovkova_deska');
      expect(wall.strip_strength_pct).toBe(50);
      expect(deck.strip_strength_pct).toBe(70);
    });

    it('foundation does not need crane', () => {
      const profile = getElementProfile('zaklady_piliru');
      expect(profile.needs_crane).toBe(false);
      expect(profile.needs_supports).toBe(false);
    });
  });

  // ─── recommendFormwork ───────────────────────────────────────────────

  describe('recommendFormwork', () => {
    it('recommends SL-1 for pier shafts', () => {
      const system = recommendFormwork('driky_piliru');
      expect(system.name).toBe('SL-1 Sloupové');
    });

    it('recommends Top 50 for bridge deck', () => {
      const system = recommendFormwork('mostovkova_deska');
      expect(system.name).toBe('Top 50');
    });

    it('recommends Frami for foundations', () => {
      const system = recommendFormwork('zaklady_piliru');
      expect(system.name).toBe('Frami Xlife');
    });

    it('recommends cornice formwork for rimsa', () => {
      const system = recommendFormwork('rimsa');
      expect(system.name).toBe('Římsové bednění T');
    });
  });

  // ─── getAdjustedAssemblyNorm ─────────────────────────────────────────

  describe('getAdjustedAssemblyNorm', () => {
    it('applies difficulty factor to assembly norm', () => {
      const system = recommendFormwork('mostovkova_deska');
      const adjusted = getAdjustedAssemblyNorm('mostovkova_deska', system);
      // mostovka difficulty = 1.2, Top 50 base = 0.60
      expect(adjusted.assembly_h_m2).toBeCloseTo(0.72, 2);
      expect(adjusted.difficulty_factor).toBe(1.2);
    });

    it('foundations have lower difficulty', () => {
      const system = recommendFormwork('zaklady_piliru');
      const adjusted = getAdjustedAssemblyNorm('zaklady_piliru', system);
      // zaklady difficulty = 0.9, Frami base = 0.72
      expect(adjusted.assembly_h_m2).toBeCloseTo(0.648, 2);
    });
  });

  // ─── estimateRebarMass ───────────────────────────────────────────────

  describe('estimateRebarMass', () => {
    it('estimates rebar for foundation', () => {
      const est = estimateRebarMass('zaklady_piliru', 50);
      expect(est.estimated_kg).toBe(5000);
      expect(est.min_kg).toBe(4000);
      expect(est.max_kg).toBe(6000);
    });

    it('bridge deck has higher reinforcement', () => {
      const est = estimateRebarMass('mostovkova_deska', 100);
      expect(est.estimated_kg).toBe(15000);
      expect(est.ratio_kg_m3).toBe(150);
    });

    it('handles small volumes', () => {
      const est = estimateRebarMass('zaklady_piliru', 1);
      expect(est.estimated_kg).toBe(100);
    });
  });

  // ─── getAllElementTypes ──────────────────────────────────────────────

  describe('getAllElementTypes', () => {
    it('returns 9 element types', () => {
      const types = getAllElementTypes();
      expect(types).toHaveLength(9);
    });

    it('each type has Czech label', () => {
      const types = getAllElementTypes();
      types.forEach(t => {
        expect(t.label_cs).toBeTruthy();
        expect(t.type).toBeTruthy();
      });
    });
  });
});
