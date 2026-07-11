/**
 * bridge-passport mapper — half A golden suite (tz-passport-json).
 *
 * Golden source = docs/specs/tz-passport-json/example_SO202_zalmanov.json
 * (Alexander's hand-built passport from the SO 202 Žalmanov TZ, quantities
 * joined from the soupis in the 2026-07-07 E2E session). The same numbers the
 * live MCP E2E produced are asserted here through the mapper.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mapPassportToPlannerInputs,
  planPassport,
  parseConcreteClassString,
  maxDeckHeightOverTerrain,
} from './bridge-passport.js';
import { planElement } from '../calculators/planner-orchestrator.js';

const EXAMPLE_PATH = join(
  __dirname, '..', '..', '..', '..',
  'docs', 'specs', 'tz-passport-json', 'example_SO202_zalmanov.json',
);
const loadExample = () => JSON.parse(readFileSync(EXAMPLE_PATH, 'utf-8'));

describe('parseConcreteClassString', () => {
  it('splits strength + primary exposure from the full TZ string', () => {
    const p = parseConcreteClassString('C30/37-XF4+XD3+XC4');
    expect(p.concrete_class).toBe('C30/37');
    expect(p.exposure_class).toBe('XF4');
    expect(p.exposure_all).toEqual(['XF4', 'XD3', 'XC4']);
  });
});

describe('mapPassportToPlannerInputs — SO 202 Žalmanov golden', () => {
  const { elements, warnings } = mapPassportToPlannerInputs(loadExample());
  const byKey = Object.fromEntries(elements.map(e => [e.key, e]));

  it('emits all 9 concrete elements', () => {
    expect(elements).toHaveLength(9);
  });

  it('deck: per-bridge volume, TZ class (not the OTSKP band), geometry, staging + tz_facts', () => {
    const d = byKey['superstructure_deck'];
    const i: any = d.input;
    expect(i.element_type).toBe('mostovkova_deska');
    expect(i.volume_m3).toBeCloseTo(1348.97, 1);          // 2697.941 / 2 decks
    expect(i.concrete_class).toBe('C35/45');               // TZ, NOT soupis «DO C40/50»
    // bug passport-exposure-single: ALL classes forwarded, not just the first
    expect(i.exposure_classes).toEqual(['XF2', 'XD1', 'XC4']);
    expect(i.exposure_class).toBeUndefined();
    expect(i.bridge_deck_subtype).toBe('dvoutramovy');
    expect(i.span_m).toBe(44.5);
    expect(i.num_spans).toBe(3);
    expect(i.nk_width_m).toBe(13.65);
    expect(i.is_prestressed).toBe(true);
    expect(i.construction_technology).toBe('fixed_scaffolding');
    expect(i.num_tacts_override).toBe(3);                  // drawing pozn. 3 honored
    expect(i.tz_facts.construction.pour_stages_count).toBe(3);
    expect(i.tz_facts.construction.quote).toContain('3 TAKTECH');
    expect(i.rebar_mass_kg).toBeCloseTo(234443, 0);        // 468886 / 2
    expect(i.prestress_strand_mass_kg).toBeCloseTo(41420, 0);
    expect(i.num_bridges).toBe(2);
    // Pattern 53: band = informative note, NOT a conflict warning
    expect(d.notes.some(n => n.includes('OTSKP cenové pásmo'))).toBe(true);
    expect(warnings.some(w => w.includes('Konflikt') && w.includes('superstructure_deck'))).toBe(false);
  });

  it('substructure elements map with TZ classes + soupis heights/tonnages', () => {
    const piers: any = byKey['pier_shafts'].input;
    expect(piers.element_type).toBe('driky_piliru');
    expect(piers.concrete_class).toBe('C35/45');           // TZ — soupis band C40/50 is informative
    expect(piers.exposure_classes).toEqual(['XF1', 'XD1', 'XC4']); // all TZ classes, not just XF1
    expect(piers.height_m).toBe(13.1);
    expect(piers.volume_m3).toBeCloseTo(180.69, 1);

    const ab: any = byKey['abutments'].input;
    expect(ab.element_type).toBe('opery_ulozne_prahy');
    expect(ab.concrete_class).toBe('C30/37');
    expect(ab.exposure_classes).toEqual(['XF4', 'XD3', 'XC4']);
    expect(ab.rebar_mass_kg).toBeCloseTo(32082, 0);

    expect((byKey['foundations_piers'].input as any).element_type).toBe('zaklady_piliru');
    expect((byKey['foundations_piers'].input as any).volume_m3).toBeCloseTo(259.2, 1);
    expect((byKey['foundations_abutments'].input as any).element_type).toBe('zaklady_oper');
    expect((byKey['foundations_abutments'].input as any).volume_m3).toBeCloseTo(174.37, 1);
  });

  it('whole-SO elements stay unsplit; prostý beton carries no rebar', () => {
    const blind: any = byKey['blinding_concrete'].input;
    expect(blind.element_type).toBe('podkladni_beton');
    expect(blind.volume_m3).toBeCloseTo(403.09, 1);
    expect(blind.num_bridges).toBeUndefined();
    expect(blind.rebar_mass_kg).toBeUndefined();
  });

  // bug passport-height-skruz (2026-07-11): deck height lives in geometry,
  // not in quantities — the mapper must forward it or the engine skips the
  // falsework (15-25 % of deck costs) with a ⛔ warning.
  it('deck: falsework height derived from geometry crossings (max governs) + NK depth', () => {
    const d = byKey['superstructure_deck'];
    const i: any = d.input;
    expect(i.height_m).toBe(14.9);               // max(8.1, 14.9, 9.9) — stream crossing
    expect(i.deck_thickness_m).toBe(2.4);        // superstructure.deck.constant_depth_m
    expect(d.notes.some(n => n.includes('Výška skruže odvozena z geometry'))).toBe(true);
  });

  it('explicit qty.height_m wins over geometry-derived height', () => {
    const passport = loadExample();
    const deckQty = passport.quantities.items.find((x: any) => x.element === 'superstructure_deck');
    deckQty.height_m = 12.0;
    const { elements } = mapPassportToPlannerInputs(passport);
    const i: any = elements.find(e => e.key === 'superstructure_deck')!.input;
    expect(i.height_m).toBe(12.0);
  });

  it('maxDeckHeightOverTerrain: object per crossing, plain number, garbage-safe', () => {
    expect(maxDeckHeightOverTerrain([
      { deck_height_over_terrain_m: { road: 8.1, stream: 14.9, field: 9.9 } },
      { deck_height_over_terrain_m: { road: 8.1, stream: 14.9, field: 9.9 } },
    ])).toBe(14.9);
    expect(maxDeckHeightOverTerrain([{ deck_height_over_terrain_m: 7.5 }])).toBe(7.5);
    expect(maxDeckHeightOverTerrain([{ deck_height_over_terrain_m: { a: 'x', b: -1 } }, {}])).toBeUndefined();
    expect(maxDeckHeightOverTerrain([])).toBeUndefined();
  });

  // bug passport-exposure-single (2026-07-11): first-token selection dropped
  // the demanding classes. Pin the DANGEROUS ordering: XC4 first, XF4 second —
  // curing must still honor XF4 (7 d TKP18 min), and the engine must SEE XF4.
  it('exposure order-independence: «C30/37-XC4+XF4» → curing governed by XF4, not XC4', () => {
    const passport = loadExample();
    const c = passport.materials_and_standards.concretes
      .find((x: any) => x.use === 'pier_shafts');
    c.class = 'C35/45-XC4+XF4';
    const { elements } = mapPassportToPlannerInputs(passport);
    const piers: any = elements.find(e => e.key === 'pier_shafts')!.input;
    expect(piers.exposure_classes).toEqual(['XC4', 'XF4']);
    const plan = planElement(piers);
    expect(plan.formwork.curing_days).toBeGreaterThanOrEqual(7); // XF4 min, TKP18
  });

  it('pier plan: rogue TZ classes stay VISIBLE as warnings (flag, never silently dropped)', () => {
    const plan = planElement(byKey['pier_shafts'].input); // XF1+XD1+XC4 from TZ
    // XF1 and XD1 are outside the driky allow-list (XC4/XD3/XF2/XF4) — the
    // engine must say so; TZ value is still honored (no gate).
    expect(plan.warnings.some(w => w.includes('XF1'))).toBe(true);
  });

  it('end-to-end: deck plan carries falsework — NO ⛔ missing-height warning, props/skruž computed', () => {
    const plan = planElement(byKey['superstructure_deck'].input);
    expect(plan.warnings.some(w => w.includes('není zadána výška'))).toBe(false);
    // Falsework/props cost present (skruž + stojky no longer silently missing)
    const costs: any = plan.costs;
    const falseworkCzk =
      (costs.formwork_rental_czk ?? 0) + (costs.props_rental_czk ?? 0) +
      (costs.mss_rental_czk ?? 0) + (costs.props_labor_czk ?? 0);
    expect(falseworkCzk).toBeGreaterThan(0);
  });

  it('mapped deck computes 3 takty × 449.66 m³ with NO tz-consistency flag (input honors TZ)', () => {
    const plan = planElement(byKey['superstructure_deck'].input);
    expect(plan.pour_decision.num_tacts).toBe(3);
    expect(plan.pour_decision.tact_volume_m3).toBeCloseTo(449.66, 1);
    const tzFlags = (plan.validation_flags ?? []).filter(f => f.rule_id === 'tz_construction_consistency');
    expect(tzFlags).toHaveLength(0);
  });
});

describe('planPassport — aggregation + honest degradation', () => {
  it('computes the whole SO: 9 elements, all calculated, real totals', () => {
    const { project } = planPassport(loadExample());
    expect(project.aggregate.elements_total).toBe(9);
    expect(project.aggregate.elements_uncalculated).toBe(0);
    expect(project.aggregate.total_norm_hours).toBeGreaterThan(0);
  });

  it('missing quantities → elements still emitted, engine marks them NEPOČÍTÁNO', () => {
    const passport = loadExample();
    delete passport.quantities;
    const { mapping, project } = planPassport(passport);
    // concretes uses with a rule still emit (6 uses; foundations key maps twice → deduped by use set)
    expect(mapping.elements.length).toBeGreaterThan(0);
    expect(project.aggregate.elements_calculated).toBe(0);
    expect(project.aggregate.elements_uncalculated).toBe(project.aggregate.elements_total);
    expect(mapping.elements.every(e => e.notes.some(n => n.includes('NEPOČÍTÁNO')))).toBe(true);
  });

  it('honest-ignore: unknown sections and unknown element keys never break the mapper', () => {
    const passport = loadExample();
    passport.future_section = { anything: [1, 2, 3] };
    passport.quantities.items.push({ element: 'space_elevator', volume_m3: 1 });
    const { elements, warnings } = mapPassportToPlannerInputs(passport);
    expect(elements).toHaveLength(9); // the unknown key is skipped, not fatal
    expect(warnings.some(w => w.includes("space_elevator"))).toBe(true);
  });

  it('genuine (non-band) TZ↔soupis class conflict → visible warning, TZ wins', () => {
    const passport = loadExample();
    const piers = passport.quantities.items.find((i: any) => i.element === 'pier_shafts');
    piers.concrete_class_soupis = 'C45/55';
    piers.soupis_class_is_otskp_band = false;
    const { elements, warnings } = mapPassportToPlannerInputs(passport);
    const input: any = elements.find(e => e.key === 'pier_shafts')!.input;
    expect(input.concrete_class).toBe('C35/45'); // TZ default preserved
    expect(warnings.some(w => w.includes('Konflikt TZ↔soupis') && w.includes('pier_shafts'))).toBe(true);
  });
});
