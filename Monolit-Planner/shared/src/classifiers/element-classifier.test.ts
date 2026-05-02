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
  extractOtskpMetadata,
  SANITY_RANGES,
  checkSanity,
  getSuitableSystemsForElement,
  checkVolumeGeometry,
  estimateExpectedVolume,
  isParamCompatibleWith,
  explainIncompatibility,
  ELEMENT_TZ_COMPATIBILITY,
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

    // OTSKP names for podkladní beton
    it('classifies OTSKP "podkladní a výplňové vrstvy z prostého betonu" as podkladni_beton', () => {
      const r1 = classifyElement('PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C25/30');
      expect(r1.element_type).toBe('podkladni_beton');
      const r2 = classifyElement('PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15');
      expect(r2.element_type).toBe('podkladni_beton');
      const r3 = classifyElement('PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25');
      expect(r3.element_type).toBe('podkladni_beton');
    });

    it('classifies abbreviated "PODKL VRSTVY" as podkladni_beton', () => {
      const r = classifyElement('PODKL VRSTVY Z PROSTÉHO BETONU');
      expect(r.element_type).toBe('podkladni_beton');
    });

    it('does NOT classify železobeton layer as podkladni_beton', () => {
      const r = classifyElement('PODKL VRSTVY ZE ŽELEZOBET DO C16/20 VČET VÝZTUŽE');
      // This is reinforced concrete — should NOT be plain podkladni_beton
      expect(r.element_type).not.toBe('podkladni_beton');
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

    it('recommends MULTIFLEX for bridge deck (slab formwork, support towers handled by props)', () => {
      const system = recommendFormwork('mostovkova_deska');
      expect(system.name).toBe('MULTIFLEX');
    });

    it('recommends Frami for foundations', () => {
      const system = recommendFormwork('zaklady_piliru');
      expect(system.name).toBe('Frami Xlife');
    });

    // Phase 3 Gate 2a (commit 2 of 4) — regression tests for horizontal
    // selector fix. Before this commit, recommendFormwork('zaklady_piliru',
    // height_m) returned Top 50 (cheapest from category-compatible pool)
    // because Frami Xlife (formwork_category='wall') was excluded from
    // horizontal pool. The selector now respects recommended_formwork[0]
    // when system is universal-applicable. These tests exercise the
    // with-height path (the buggy path; the no-height tests always
    // returned Frami via short-circuit at L1023).
    it('recommends Frami for zaklady_piliru WITH height_m (post-Phase-3 horizontal fix)', () => {
      const system = recommendFormwork('zaklady_piliru', 1.2);
      expect(system.name).toBe('Frami Xlife');
      expect(system.pour_role).toBe('formwork');
    });

    it('recommends Frami for zaklady_oper WITH height_m (Phase 3 — paralelní k zaklady_piliru)', () => {
      const system = recommendFormwork('zaklady_oper', 1.5);
      expect(system.name).toBe('Frami Xlife');
      expect(system.pour_role).toBe('formwork');
    });

    it('recommends Frami for zakladova_deska WITH height_m (Phase 3 horizontal fix side-effect — pre-empts Phase 4)', () => {
      const system = recommendFormwork('zakladova_deska', 0.8);
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
      // mostovka difficulty = 1.2, MULTIFLEX base = 0.50
      expect(adjusted.assembly_h_m2).toBeCloseTo(0.60, 2);
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
      // BUG 4: rebar raised 100→120 kg/m³, range [100,150]
      const est = estimateRebarMass('zaklady_piliru', 50);
      expect(est.estimated_kg).toBe(6000);
      expect(est.min_kg).toBe(5000);
      expect(est.max_kg).toBe(7500);
    });

    it('bridge deck has higher reinforcement', () => {
      const est = estimateRebarMass('mostovkova_deska', 100);
      expect(est.estimated_kg).toBe(15000);
      expect(est.ratio_kg_m3).toBe(150);
    });

    it('handles small volumes', () => {
      // BUG 4: 1 m³ × 120 kg/m³ = 120 kg
      const est = estimateRebarMass('zaklady_piliru', 1);
      expect(est.estimated_kg).toBe(120);
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

    // Phase 3 Gate 2a (2026-04-30): zaklady_oper recognition tests.
    // Higher-priority KEYWORD_RULES entry (priority 11 vs zaklady_piliru's 10)
    // ensures "základ opěry" specifically matches zaklady_oper, not zaklady_piliru
    // via generic "základy" keyword fall-through.
    it('ZÁKLAD OPĚRY → zaklady_oper (specific match, not zaklady_piliru)', () => {
      expect(classifyElement('ZÁKLAD OPĚRY OP1 ZE ŽELEZOBETONU C25/30').element_type)
        .toBe('zaklady_oper');
    });

    it('ZÁKLADY OPĚR → zaklady_oper', () => {
      expect(classifyElement('ZÁKLADY OPĚR MOSTNÍCH').element_type)
        .toBe('zaklady_oper');
    });

    it('OPĚRA ZÁKLAD → zaklady_oper', () => {
      expect(classifyElement('Opěra základ železobeton').element_type)
        .toBe('zaklady_oper');
    });

    // Negative: generic "základy" without "opěr" still matches zaklady_piliru
    // (existing behavior preserved — Phase 3 commit 1 only adds new type, does
    // not reroute existing matches)
    it('ZÁKLADY (without opěr) + bridge context → zaklady_piliru (unchanged)', () => {
      expect(classifyElement('ZÁKLADY PILÍŘŮ', { is_bridge: true }).element_type)
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

    // PODKLADNÍ = podkladni_beton (was 'other' before BUG 11 catalog expansion)
    it('PODKLADNÍ A VÝPLŇOVÉ VRSTVY → podkladni_beton', () => {
      expect(classifyElement('PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15').element_type)
        .toBe('podkladni_beton');
    });

    it('PODKLADNÍ Z PROSTÉHO BETONU C25/30 → podkladni_beton', () => {
      expect(classifyElement('PODKLADNÍ VRSTVY Z PROSTÉHO BETONU C25/30').element_type)
        .toBe('podkladni_beton');
    });

    it('PODKLADNÍ Z PROSTÉHO BETONU C20/25 → podkladni_beton', () => {
      expect(classifyElement('PODKLADNÍ VRSTVY Z PROSTÉHO BETONU C20/25').element_type)
        .toBe('podkladni_beton');
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

    // Křídla as separate element type
    it('"KŘÍDLA OPĚRY OP1" → kridla_opery (standalone wing)', () => {
      expect(classifyElement('KŘÍDLA OPĚRY OP1', { is_bridge: true }).element_type)
        .toBe('kridla_opery'); // standalone wing — no "MOSTNÍ" prefix
    });
    it('"KŘÍDLO D SO 206" → kridla_opery (standalone wing)', () => {
      expect(classifyElement('KŘÍDLO D SO 206', { is_bridge: true }).element_type)
        .toBe('kridla_opery');
    });
    it('"KŘÍDLA MOSTNÍ" → kridla_opery', () => {
      expect(classifyElement('KŘÍDLA MOSTNÍ', { is_bridge: true }).element_type)
        .toBe('kridla_opery');
    });
    it('"MOSTNÍ OPĚRY A KŘÍDLA" stays opery_ulozne_prahy (composite)', () => {
      expect(classifyElement('MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', { is_bridge: true }).element_type)
        .toBe('opery_ulozne_prahy');
    });

    it('PŘEDPJATÝ always → mostovkova_deska regardless of context', () => {
      expect(classifyElement('PŘEDPJATÝ BETON C40/50').element_type)
        .toBe('mostovkova_deska');
    });

    it('PODKLADNÍ → podkladni_beton regardless of bridge context', () => {
      expect(classifyElement('PODKLADNÍ VRSTVY Z PROSTÉHO BETONU C12/15', { is_bridge: true }).element_type)
        .toBe('podkladni_beton');
    });
  });

  describe('getAllElementTypes', () => {
    // BUG 11: +2 new types (podkladni_beton, podlozkovy_blok)
    // Phase 3 Gate 2a (2026-04-30): +1 zaklady_oper → 25 types (14 bridge + 11 building)
    it('returns 25 element types (14 bridge + 11 building)', () => {
      const types = getAllElementTypes();
      expect(types).toHaveLength(25);
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

  // ─── OTSKP catalog matching ────────────────────────────────────────────

  describe('OTSKP catalog match', () => {
    it('trámová mostovka → mostovkova_deska, subtype dvoutram, confidence 1.0', () => {
      const r = classifyElement('MOSTNÍ NOSNÉ TRÁM KONSTR Z PŘEDPJ BET DO C40/50');
      expect(r.element_type).toBe('mostovkova_deska');
      expect(r.confidence).toBe(1.0);
      expect(r.classification_source).toBe('otskp');
      expect(r.bridge_deck_subtype_detected).toBe('dvoutram');
      expect(r.concrete_class_detected).toBe('C40/50');
      expect(r.is_prestressed_detected).toBe(true);
    });

    it('opěry a křídla → opery_ulozne_prahy, has_kridla, confidence 1.0', () => {
      const r = classifyElement('MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37');
      expect(r.element_type).toBe('opery_ulozne_prahy');
      expect(r.confidence).toBe(1.0);
      expect(r.classification_source).toBe('otskp');
      expect(r.has_kridla_detected).toBe(true);
      expect(r.concrete_class_detected).toBe('C30/37');
      expect(r.is_prestressed_detected).toBe(false);
    });

    it('komorová mostovka → jednokomora', () => {
      const r = classifyElement('MOSTNÍ NOSNÉ KOMOROVÉ KONSTR ZE ŽELEZOBET DO C40/50');
      expect(r.element_type).toBe('mostovkova_deska');
      expect(r.bridge_deck_subtype_detected).toBe('jednokomora');
    });

    it('římsy → rimsa, confidence 1.0', () => {
      const r = classifyElement('ŘÍMSY ZE ŽELEZOBETONU DO C30/37');
      expect(r.element_type).toBe('rimsa');
      expect(r.confidence).toBe(1.0);
      expect(r.classification_source).toBe('otskp');
    });

    it('přechodové desky → prechodova_deska', () => {
      const r = classifyElement('PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30');
      expect(r.element_type).toBe('prechodova_deska');
      expect(r.confidence).toBe(1.0);
    });

    it('pilíře a stativa → driky_piliru', () => {
      const r = classifyElement('MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37');
      expect(r.element_type).toBe('driky_piliru');
      expect(r.confidence).toBe(1.0);
    });

    it('prefab nosníky → mostovkova_deska, is_prefab', () => {
      const r = classifyElement('MOSTNÍ NOSNÍKY Z DÍLCŮ Z PŘEDPJ BET DO C40/50');
      expect(r.element_type).toBe('mostovkova_deska');
      expect(r.is_prefab).toBe(true);
      expect(r.is_prestressed_detected).toBe(true);
    });

    it('keyword fallback has source "keywords"', () => {
      const r = classifyElement('ZÁKLADY PILÍŘŮ C30/37-XC2', { is_bridge: true });
      expect(r.classification_source).toBe('keywords');
      expect(r.element_type).toBe('zaklady_piliru');
      expect(r.concrete_class_detected).toBe('C30/37');
    });
  });

  // ─── extractOtskpMetadata ──────────────────────────────────────────────

  describe('extractOtskpMetadata', () => {
    it('extracts C30/37', () => {
      expect(extractOtskpMetadata('OPĚRY ZE ŽELEZOVÉHO BETONU DO C30/37').concrete_class).toBe('C30/37');
    });
    it('extracts C40/50', () => {
      expect(extractOtskpMetadata('PŘEDPJATÝ BETON C40/50').concrete_class).toBe('C40/50');
    });
    it('detects prestressed', () => {
      expect(extractOtskpMetadata('PŘEDPJ BET DO C40/50').is_prestressed).toBe(true);
    });
    it('detects reinforced (not prestressed)', () => {
      expect(extractOtskpMetadata('ŽELEZOVÉHO BETONU DO C30/37').is_prestressed).toBe(false);
    });
    it('detects prefab', () => {
      expect(extractOtskpMetadata('NOSNÍKY Z DÍLCŮ').is_prefab).toBe(true);
    });
    it('no metadata for plain name', () => {
      const m = extractOtskpMetadata('ZÁKLADY');
      expect(m.concrete_class).toBeUndefined();
      expect(m.is_prestressed).toBeUndefined();
    });
  });

  // ─── Mostovka A1 (2026-04-16): height vs deck thickness split ────────
  describe('SANITY_RANGES — mostovkova_deska height/thickness split', () => {
    it('height_m range covers real prop heights (4–20 m), not deck thickness', () => {
      const r = SANITY_RANGES.mostovkova_deska;
      expect(r.height_m).toEqual([4, 20]);
      expect(r.deck_thickness_m).toEqual([0.3, 2.5]);
    });

    it('6 m prop height no longer flagged as "neobvykle velká"', () => {
      const issues = checkSanity('mostovkova_deska', { height_m: 6 });
      expect(issues).toHaveLength(0);
    });

    it('flags prop height outside 4–20 m (e.g. 2 m is too short for mostovka)', () => {
      const issues = checkSanity('mostovkova_deska', { height_m: 2 });
      expect(issues).toHaveLength(1);
      expect(issues[0].field).toBe('height_m');
      expect(issues[0].label_cs).toBe('Výška nad terénem');
    });

    it('flags deck thickness outside 0.3–2.5 m independently of prop height', () => {
      const issues = checkSanity('mostovkova_deska', { deck_thickness_m: 3.5 });
      expect(issues.some(i => i.field === 'deck_thickness_m')).toBe(true);
    });

    it('other element types keep their original height_m range', () => {
      expect(SANITY_RANGES.stropni_deska.height_m).toEqual([0.12, 0.40]);
      expect(SANITY_RANGES.stena.height_m).toEqual([2.5, 12.0]);
    });
  });

  // ─── Terminology Commit 3 (Gate 2.1 — 2026-04-29): canonical correction.
  // Per DOKA katalog + canonical doc §9.1, Top 50 is nosníkové bednění
  // (Vrstva 1 per §9.2), NOT falsework (Vrstva 3). Selector still returns
  // Top 50 for mostovka — only its pour_role classification is corrected.
  // The actual falsework under deck is Staxo 100 (Vrstva 3), separately
  // calculated by the orchestrator via calculateProps(). ───
  describe('recommendFormwork — pour_role aware', () => {
    it('mostovka with clearance > 4 m returns Top 50 (formwork, nosnikove)', () => {
      const sys = recommendFormwork('mostovkova_deska', 8);
      expect(sys.name).toBe('Top 50');
      expect(sys.pour_role).toBe('formwork');
      expect(sys.formwork_subtype).toBe('nosnikove');
    });

    it('mostovka with clearance ≥ 8 m STILL returns Top 50 (not Staxo 100)', () => {
      const sys = recommendFormwork('mostovkova_deska', 12);
      expect(sys.name).toBe('Top 50');
      expect(sys.pour_role).toBe('formwork');
      expect(sys.formwork_subtype).toBe('nosnikove');
    });
  });

  describe('getSuitableSystemsForElement — applicable_element_types allow-list', () => {
    it('excludes Dokaflex + MULTIFLEX + SKYDECK + CC-4 from mostovka candidate pool', () => {
      const { all } = getSuitableSystemsForElement('mostovkova_deska');
      const names = all.map(s => s.name);
      expect(names).not.toContain('Dokaflex');
      expect(names).not.toContain('MULTIFLEX');
      expect(names).not.toContain('SKYDECK');
      expect(names).not.toContain('CC-4');
    });

    it('keeps Dokaflex + MULTIFLEX in the pool for stropni_deska (building slab)', () => {
      const { all } = getSuitableSystemsForElement('stropni_deska');
      const names = all.map(s => s.name);
      expect(names).toContain('Dokaflex');
      expect(names).toContain('MULTIFLEX');
    });

    it('excludes MSS entries (mss_integrated) from every normal candidate pool', () => {
      for (const etype of ['mostovkova_deska', 'stropni_deska', 'stena'] as const) {
        const { all } = getSuitableSystemsForElement(etype);
        const names = all.map(s => s.name);
        expect(names).not.toContain('DOKA MSS');
        expect(names).not.toContain('VARIOKIT Mobile');
      }
    });

    it('VARIOKIT HD 200 (PERI bridge falsework) is available for mostovka', () => {
      const { all } = getSuitableSystemsForElement('mostovkova_deska');
      const names = all.map(s => s.name);
      expect(names).toContain('VARIOKIT HD 200');
    });
  });

  // ─── Volume-vs-geometry validation (2026-04-17) ──────────────────────
  describe('checkVolumeGeometry', () => {
    it('SO-207 bug — V=605 m³ for 9×36 m × 13 m estakáda triggers CRITICAL', () => {
      const issue = checkVolumeGeometry('mostovkova_deska', 605, {
        span_m: 36, num_spans: 9, nk_width_m: 13, bridge_deck_subtype: 'dvoutram',
      });
      expect(issue).not.toBeNull();
      expect(issue!.severity).toBe('critical');
      expect(issue!.ratio).toBeLessThan(0.3);
      expect(issue!.message_cs).toContain('KRITICKÉ');
      expect(issue!.message_cs.toLowerCase()).toContain('pole');
    });

    it('SO-207 correct — V=4000 m³ for same geometry lands OK', () => {
      const issue = checkVolumeGeometry('mostovkova_deska', 4000, {
        span_m: 36, num_spans: 9, nk_width_m: 13, bridge_deck_subtype: 'dvoutram',
      });
      // Expected = 36 × 9 × 13 × 1.0 = 4 212 m³ → ratio ≈ 0.95 → OK
      expect(issue).toBeNull();
    });

    it('deskovy subtype uses thinner equivalent (0.5 m) than trám (1.0 m)', () => {
      const v = estimateExpectedVolume('mostovkova_deska', {
        span_m: 30, num_spans: 5, nk_width_m: 10, bridge_deck_subtype: 'deskovy',
      });
      expect(v).toBeCloseTo(30 * 5 * 10 * 0.5, 1); // 750 m³
    });

    it('pilota Ø900 × 10 m × 20 ks ≈ 127 m³ (critical when user enters 10 m³)', () => {
      const expected = estimateExpectedVolume('pilota', {
        pile_diameter_mm: 900, pile_length_m: 10, pile_count: 20,
      });
      expect(expected).toBeCloseTo(Math.PI * 0.45 * 0.45 * 10 * 20, 1);
      const issue = checkVolumeGeometry('pilota', 10, {
        pile_diameter_mm: 900, pile_length_m: 10, pile_count: 20,
      });
      expect(issue!.severity).toBe('critical');
    });

    it('returns null when geometry fields are missing (cannot cross-check)', () => {
      expect(checkVolumeGeometry('mostovkova_deska', 1000, {})).toBeNull();
      expect(checkVolumeGeometry('pilota', 50, {})).toBeNull();
    });

    it('returns null for element types without a geometry formula', () => {
      expect(checkVolumeGeometry('stena', 100, {})).toBeNull();
      expect(checkVolumeGeometry('zakladova_deska', 100, {})).toBeNull();
    });

    it('mostovka V slightly under (ratio 0.5) → WARNING, not CRITICAL', () => {
      const issue = checkVolumeGeometry('mostovkova_deska', 2000, {
        span_m: 36, num_spans: 9, nk_width_m: 13, bridge_deck_subtype: 'dvoutram',
      });
      // Expected ≈ 4212, actual = 2000 → ratio ≈ 0.47 → warning
      expect(issue!.severity).toBe('warning');
      expect(issue!.message_cs).toContain('⚠️');
    });

    it('mostovka V excessive (ratio > 3) → CRITICAL (upper bound)', () => {
      const issue = checkVolumeGeometry('mostovkova_deska', 15000, {
        span_m: 36, num_spans: 9, nk_width_m: 13, bridge_deck_subtype: 'dvoutram',
      });
      expect(issue!.severity).toBe('critical');
      expect(issue!.ratio).toBeGreaterThan(3);
      expect(issue!.message_cs).toContain('větší');
    });
  });

  // ─── Task 1 (2026-04-20): TZ-parameter compatibility ────────────────────
  describe('isParamCompatibleWith() — TZ context compatibility', () => {
    it('universal params compatible with every element type', () => {
      // Task 2 (2026-04-20): `exposure_classes` (plural) is universal for
      // the same reason as `exposure_class` (singular) — every element
      // can have an environmental-exposure selection.
      const universal = ['concrete_class', 'exposure_class', 'exposure_classes',
        'volume_m3', 'formwork_area_m2', 'reinforcement_total_kg',
        'reinforcement_ratio_kg_m3'];
      for (const et of Object.keys(ELEMENT_TZ_COMPATIBILITY)) {
        for (const p of universal) {
          expect(isParamCompatibleWith(p, et as any)).toBe(true);
        }
      }
    });

    it('bridge-deck params (span_m, num_spans, nk_width_m, is_prestressed) NOT compatible with foundations', () => {
      const bridgeOnly = ['span_m', 'num_spans', 'nk_width_m', 'is_prestressed',
        'prestress_cables_count', 'prestress_tensioning', 'bridge_deck_subtype'];
      const foundations: any[] = ['zaklady_piliru', 'zakladova_deska',
        'zakladovy_pas', 'zakladova_patka'];
      for (const et of foundations) {
        for (const p of bridgeOnly) {
          expect(isParamCompatibleWith(p, et)).toBe(false);
        }
      }
    });

    it('bridge-deck params ARE compatible with mostovkova_deska and rigel', () => {
      const bridgeOnly = ['span_m', 'num_spans', 'is_prestressed',
        'prestress_cables_count', 'bridge_deck_subtype'];
      for (const p of bridgeOnly) {
        expect(isParamCompatibleWith(p, 'mostovkova_deska')).toBe(true);
        expect(isParamCompatibleWith(p, 'rigel')).toBe(true);
      }
    });

    it('pile_diameter_mm compatible only with pilota (+ "other" fallback)', () => {
      expect(isParamCompatibleWith('pile_diameter_mm', 'pilota')).toBe(true);
      expect(isParamCompatibleWith('pile_diameter_mm', 'other')).toBe(true);
      expect(isParamCompatibleWith('pile_diameter_mm', 'zaklady_piliru')).toBe(false);
      expect(isParamCompatibleWith('pile_diameter_mm', 'mostovkova_deska')).toBe(false);
    });

    it('total_length_m compatible with walls but not foundations', () => {
      expect(isParamCompatibleWith('total_length_m', 'operne_zdi')).toBe(true);
      expect(isParamCompatibleWith('total_length_m', 'stena')).toBe(true);
      expect(isParamCompatibleWith('total_length_m', 'kridla_opery')).toBe(true);
      expect(isParamCompatibleWith('total_length_m', 'zakladova_patka')).toBe(false);
    });

    it('height_m compatible with most elements but not pure slabs', () => {
      expect(isParamCompatibleWith('height_m', 'driky_piliru')).toBe(true);
      expect(isParamCompatibleWith('height_m', 'operne_zdi')).toBe(true);
      expect(isParamCompatibleWith('height_m', 'pilota')).toBe(true);
      expect(isParamCompatibleWith('height_m', 'rimsa')).toBe(true);
    });

    it('element_type is NEVER in any compatibility list (lock-only field)', () => {
      for (const et of Object.keys(ELEMENT_TZ_COMPATIBILITY)) {
        const list = ELEMENT_TZ_COMPATIBILITY[et as any];
        expect(list).not.toContain('element_type');
      }
    });

    it('unknown param defaults to allow (forward-compat)', () => {
      expect(isParamCompatibleWith('future_param_xyz', 'zaklady_piliru')).toBe(true);
    });

    it('all 24 element types have a compatibility entry', () => {
      const allTypes = getAllElementTypes();
      for (const t of allTypes) {
        expect(ELEMENT_TZ_COMPATIBILITY).toHaveProperty(t.type);
      }
    });
  });

  describe('explainIncompatibility() — Czech reasons for ignored TZ params', () => {
    it('returns null for compatible params', () => {
      expect(explainIncompatibility('concrete_class', 'zaklady_piliru')).toBeNull();
      expect(explainIncompatibility('span_m', 'mostovkova_deska')).toBeNull();
    });

    it('bridge-deck reason mentions "mostní nosné konstrukce"', () => {
      const reason = explainIncompatibility('span_m', 'zaklady_piliru');
      expect(reason).not.toBeNull();
      expect(reason).toMatch(/mostní/i);
    });

    it('pile reason mentions "pilot" + element label', () => {
      const reason = explainIncompatibility('pile_diameter_mm', 'zaklady_piliru');
      expect(reason).not.toBeNull();
      expect(reason).toMatch(/pilot/i);
    });

    it('VP4 live regression — opěrná zeď: bridge deck params rejected, reinforcement_ratio accepted', () => {
      // Scenario: user calculates opěrná zeď, TZ extracted {reinforcement_ratio_kg_m3, span_m}
      // Expected: ratio compatible (universal), span_m NOT compatible → explains why.
      expect(isParamCompatibleWith('reinforcement_ratio_kg_m3', 'operne_zdi')).toBe(true);
      expect(isParamCompatibleWith('span_m', 'operne_zdi')).toBe(false);
      const reason = explainIncompatibility('span_m', 'operne_zdi');
      // Label from ELEMENT_CATALOG is "Opěrné zdi" (plural)
      expect(reason).toContain('Opěrné zdi');
    });

    it('AC 10 regression — ZÁKLADY pozice + most TZ: span_m/num_spans/prestress/deck_subtype rejected', () => {
      // Replicates bug: user opens calculator from position "272325 ZÁKLADY ŽELEZOBETON",
      // pastes TZ of whole bridge object ("rozpětí 32 m, L=160 m, 5 polí, předpjatý").
      // Expected: element_type stays zaklady_piliru, all bridge-deck params rejected.
      const bridgeParams = ['span_m', 'num_spans', 'is_prestressed',
        'prestress_cables_count', 'prestress_tensioning', 'bridge_deck_subtype', 'nk_width_m'];
      for (const p of bridgeParams) {
        expect(isParamCompatibleWith(p, 'zaklady_piliru')).toBe(false);
        expect(explainIncompatibility(p, 'zaklady_piliru')).not.toBeNull();
      }
      // Universal params still apply (concrete class from TZ is legit)
      expect(isParamCompatibleWith('concrete_class', 'zaklady_piliru')).toBe(true);
      expect(isParamCompatibleWith('exposure_class', 'zaklady_piliru')).toBe(true);
    });
  });
});
