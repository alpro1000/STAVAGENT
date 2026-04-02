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

    it('classifies building columns', () => {
      const result = classifyElement('SLOUPY 1.NP');
      expect(result.element_type).toBe('sloup');
    });

    it('classifies bridge piers', () => {
      const result = classifyElement('Dříky pilířů P1-P3');
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
    it('recommends VARIO GT 24 for pier shafts', () => {
      const system = recommendFormwork('driky_piliru');
      expect(system.name).toBe('VARIO GT 24');
    });

    it('recommends Staxo 100 for bridge deck (primary support tower)', () => {
      const system = recommendFormwork('mostovkova_deska');
      expect(system.name).toBe('Staxo 100');
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
      // mostovka difficulty = 1.2, Staxo 100 base = 0.90
      expect(adjusted.assembly_h_m2).toBeCloseTo(1.08, 2);
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

  // ─── Bridge context classification (legacy tests) ─────────────────────

  describe('classifyElement — bridge context (legacy)', () => {
    it('"NOSNÁ KONSTRUKCE" with bridge context → mostovkova_deska', () => {
      const result = classifyElement('NOSNÁ KONSTRUKCE C35/45-XF2', { is_bridge: true });
      expect(result.element_type).toBe('mostovkova_deska');
    });

    it('"Stěna" in bridge context → operne_zdi (bridge equivalent)', () => {
      const result = classifyElement('Monolitická stěna', { is_bridge: true });
      expect(result.element_type).toBe('operne_zdi');
    });

    it('context is optional — backward compatible', () => {
      const result = classifyElement('ZÁKLADY PILÍŘŮ');
      expect(result.element_type).toBe('zaklady_piliru');
    });
  });

  // ─── Real bridge project positions (15 test cases) ──────────────────

  describe('classifyElement — real bridge project mapping', () => {
    // Bridge elements
    it('MOSTNÍ PILÍŘE A STATIVA → driky_piliru', () => {
      expect(classifyElement('MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C40/50').element_type)
        .toBe('driky_piliru');
    });

    it('PILOTY ZE ŽELEZOBETONU → pilota', () => {
      expect(classifyElement('PILOTY ZE ŽELEZOBETONU C30/37').element_type)
        .toBe('pilota');
    });

    it('ŘÍMSY ZE ŽELEZOBETONU → rimsa', () => {
      expect(classifyElement('ŘÍMSY ZE ŽELEZOBETONU DO C30/37').element_type)
        .toBe('rimsa');
    });

    it('PŘECHODOVÉ DESKY MOSTNÍCH OPĚR → prechodova_deska (21st type)', () => {
      expect(classifyElement('PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30').element_type)
        .toBe('prechodova_deska');
    });

    it('MOSTNÍ NOSNÉ TRÁM KONSTR Z PŘEDPJ BET → mostovkova_deska', () => {
      expect(classifyElement('MOSTNÍ NOSNÉ TRÁM KONSTR Z PŘEDPJ BET DO C40/50').element_type)
        .toBe('mostovkova_deska');
    });

    it('MOSTNÍ OPĚRY A KŘÍDLA → opery_ulozne_prahy', () => {
      expect(classifyElement('MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37').element_type)
        .toBe('opery_ulozne_prahy');
    });

    it('ZÁKLADY + bridge context → zaklady_piliru', () => {
      expect(classifyElement('ZÁKLADY ZE ŽELEZOBETONU DO C25/30', { is_bridge: true }).element_type)
        .toBe('zaklady_piliru');
    });

    // Building elements in a bridge project
    it('SCHODIŠŤOVÉ STUPNĚ → schodiste', () => {
      expect(classifyElement('SCHODIŠŤOVÉ STUPNĚ, Z DÍLCŮ ŽELEZOBETON DO C30/37').element_type)
        .toBe('schodiste');
    });

    it('PATKY Z PROSTÉHO BETONU C25/30 → zakladova_patka', () => {
      expect(classifyElement('PATKY Z PROSTÉHO BETONU C25/30').element_type)
        .toBe('zakladova_patka');
    });

    it('PATKY Z PROSTÉHO BETONU C20/25 → zakladova_patka', () => {
      expect(classifyElement('PATKY Z PROSTÉHO BETONU C20/25').element_type)
        .toBe('zakladova_patka');
    });

    // PODKLADNÍ = always other
    it('PODKLADNÍ A VÝPLŇOVÉ VRSTVY → other', () => {
      expect(classifyElement('PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15').element_type)
        .toBe('other');
    });

    it('PODKLADNÍ Z PROSTÉHO BETONU C25/30 → other', () => {
      expect(classifyElement('PODKLADNÍ VRSTVY Z PROSTÉHO BETONU C25/30').element_type)
        .toBe('other');
    });

    it('PODKLADNÍ Z PROSTÉHO BETONU C20/25 → other', () => {
      expect(classifyElement('PODKLADNÍ VRSTVY Z PROSTÉHO BETONU C20/25').element_type)
        .toBe('other');
    });

    it('PODKL VRSTVY ZE ŽELEZOBET → other', () => {
      expect(classifyElement('PODKL VRSTVY ZE ŽELEZOBET DO C16/20 VČET VÝZTUŽE').element_type)
        .toBe('other');
    });

    // STŘÍKANÝ = always other
    it('STŘÍKANÝ ŽELEZOBETON → other', () => {
      expect(classifyElement('STŘÍKANÝ ŽELEZOBETON DO C25/30').element_type)
        .toBe('other');
    });
  });

  // ─── Extended bridge position names (KROS/ÚRS style BOQ) ────────────

  describe('classifyElement — extended bridge positions', () => {
    // Superstructure variants
    it('NOSNÁ KONSTRUKCE MOSTU → mostovkova_deska', () => {
      expect(classifyElement('NOSNÁ KONSTRUKCE MOSTU ZE ŽELEZOBETONU C40/50').element_type)
        .toBe('mostovkova_deska');
    });

    it('MOSTNÍ SVRŠEK → mostovkova_deska', () => {
      expect(classifyElement('MOSTNÍ SVRŠEK Z BETONU C35/45').element_type)
        .toBe('mostovkova_deska');
    });

    it('KOMOROVÝ NOSNÍK → mostovkova_deska', () => {
      expect(classifyElement('KOMOROVÝ NOSNÍK MOSTU C40/50').element_type)
        .toBe('mostovkova_deska');
    });

    it('PODÉLNÝ NOSNÍK MOSTU → mostovkova_deska', () => {
      expect(classifyElement('PODÉLNÝ NOSNÍK MOSTU').element_type)
        .toBe('mostovkova_deska');
    });

    // Pier caps / crossbeams
    it('HLAVICE PILÍŘŮ → rigel', () => {
      expect(classifyElement('HLAVICE PILÍŘŮ ZE ŽELEZOBETONU C30/37').element_type)
        .toBe('rigel');
    });

    it('PŘÍČNÍK MOSTU → rigel', () => {
      expect(classifyElement('PŘÍČNÍK MOSTU ZE ŽELEZOBETONU C35/45').element_type)
        .toBe('rigel');
    });

    // Pier stem variants
    it('DŘÍKY PILÍŘŮ → driky_piliru', () => {
      expect(classifyElement('DŘÍKY PILÍŘŮ ZE ŽELEZOBETONU C35/45').element_type)
        .toBe('driky_piliru');
    });

    it('TĚLO PILÍŘŮ → driky_piliru', () => {
      expect(classifyElement('TĚLO PILÍŘŮ MOSTU ZE ŽELEZOBETONU C30/37').element_type)
        .toBe('driky_piliru');
    });

    // Abutment / wings
    it('MOSTNÍ OPĚRY A KŘÍDLA (v2) → opery_ulozne_prahy', () => {
      expect(classifyElement('OPĚRY MOSTU A KŘÍDLA ZE ŽELEZOBETONU C30/37').element_type)
        .toBe('opery_ulozne_prahy');
    });

    it('ÚLOŽNÉ PRAHY → opery_ulozne_prahy', () => {
      expect(classifyElement('ÚLOŽNÉ PRAHY ZE ŽELEZOBETONU C30/37').element_type)
        .toBe('opery_ulozne_prahy');
    });

    // Foundation block
    it('ZÁKLADOVÝ BLOK OPĚR → zaklady_piliru', () => {
      expect(classifyElement('ZÁKLADOVÝ BLOK OPĚR ZE ŽELEZOBETONU C25/30').element_type)
        .toBe('zaklady_piliru');
    });

    // Parapet / railing walls → rimsa
    it('ZÁBRADELNÍ ZÍDKY → rimsa', () => {
      expect(classifyElement('ZÁBRADELNÍ ZÍDKY ZE ŽELEZOBETONU C30/37').element_type)
        .toBe('rimsa');
    });

    it('ŘÍMSOVÁ DESKA → rimsa', () => {
      expect(classifyElement('ŘÍMSOVÁ DESKA ZE ŽELEZOBETONU C30/37').element_type)
        .toBe('rimsa');
    });

    // Non-structural early-exit
    it('IZOLAČNÍ VRSTVY MOSTU → other', () => {
      expect(classifyElement('IZOLAČNÍ VRSTVY MOSTU Z BETONU C16/20').element_type)
        .toBe('other');
    });

    it('ZÁLIVKA SPÁR → other', () => {
      expect(classifyElement('ZÁLIVKA SPÁR BETONU C25/30').element_type)
        .toBe('other');
    });

    it('MONOLITICKÁ VOZOVKA → other', () => {
      expect(classifyElement('MONOLITICKÁ VOZOVKA Z BETONU C30/37').element_type)
        .toBe('other');
    });

    it('BETONOVÝ KRYT VOZOVKY → other', () => {
      expect(classifyElement('BETONOVÝ KRYT VOZOVKY C30/37').element_type)
        .toBe('other');
    });
  });

  // ─── Bridge context disambiguation ────────────────────────────────────

  describe('classifyElement — bridge context disambiguation', () => {
    it('"Beton pilířů C30/37" without context → sloup', () => {
      expect(classifyElement('Beton pilířů C30/37').element_type).toBe('sloup');
    });

    it('"Beton pilířů C30/37" WITH bridge context → driky_piliru', () => {
      expect(classifyElement('Beton pilířů C30/37', { is_bridge: true }).element_type)
        .toBe('driky_piliru');
    });

    it('"ZÁKLADY ZE ŽELEZOBETONU" without context → zakladovy_pas', () => {
      const result = classifyElement('ZÁKLADY ZE ŽELEZOBETONU DO C25/30');
      // Without bridge context: generic "základy" → zakladovy_pas or zakladova_deska
      expect(['zakladovy_pas', 'zakladova_deska', 'zaklady_piliru']).toContain(result.element_type);
    });

    it('"ZÁKLADY ZE ŽELEZOBETONU" WITH bridge context → zaklady_piliru', () => {
      expect(classifyElement('ZÁKLADY ZE ŽELEZOBETONU DO C25/30', { is_bridge: true }).element_type)
        .toBe('zaklady_piliru');
    });

    // New: pruvlak → rigel in bridge context
    it('"TRÁM ZE ŽELEZOBETONU" WITH bridge context → rigel', () => {
      expect(classifyElement('TRÁM ZE ŽELEZOBETONU C30/37', { is_bridge: true }).element_type)
        .toBe('rigel');
    });

    // New: stena → operne_zdi in bridge context
    it('"STĚNA ZE ŽELEZOBETONU" WITH bridge context → operne_zdi', () => {
      expect(classifyElement('STĚNA ZE ŽELEZOBETONU C25/30', { is_bridge: true }).element_type)
        .toBe('operne_zdi');
    });

    // New: patky → zaklady_piliru in bridge context
    it('"PATKY Z BETONU" WITH bridge context → zaklady_piliru', () => {
      expect(classifyElement('PATKY Z PROSTÉHO BETONU C25/30', { is_bridge: true }).element_type)
        .toBe('zaklady_piliru');
    });

    it('PŘEDPJATÝ always → mostovkova_deska regardless of context', () => {
      expect(classifyElement('PŘEDPJATÝ BETON C40/50').element_type)
        .toBe('mostovkova_deska');
    });

    it('PODKLADNÍ not affected by bridge context', () => {
      expect(classifyElement('PODKLADNÍ VRSTVY Z PROSTÉHO BETONU C12/15', { is_bridge: true }).element_type)
        .toBe('other');
    });
  });

  describe('getAllElementTypes', () => {
    it('returns 21 element types (10 bridge + 11 building)', () => {
      const types = getAllElementTypes();
      expect(types).toHaveLength(21);
    });

    it('includes prechodova_deska', () => {
      const types = getAllElementTypes();
      expect(types.find(t => t.type === 'prechodova_deska')).toBeTruthy();
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
