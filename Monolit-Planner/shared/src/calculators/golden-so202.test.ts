/**
 * Golden test — SO-202 D6 Karlovy Vary, Most na sil. I/6 v km 0,900.
 *
 * Reference: `test-data/tz/SO-202_D6_most_golden_test.md` (audit Section G).
 *
 * Part A recalibration (2026-06-11): §5f now models the PDPS technology —
 * TZ D-01-02-01 (VIAPONT) §7.2: «Předpokládá se betonáž NK na pevné skruži
 * v jednom taktu»; §6.11.3: «Nosná konstrukce bude betonována v jedné etapě
 * na pevné skruži». Volume per bridge = VV position 422336 (1 386.700 m³
 * oba mosty) ÷ 2 = 693.35 m³ — the previous 605 m³ was an odhad.
 * The old 6-tact × 20 m input is preserved BELOW as an explicitly marked
 * SYNTHETIC multi-tact stress-test (NOT PDPS) until the Žalmanov golden
 * (Part C) provides a real PDPS multi-tact etalon.
 *
 * Per `docs/steering/domain.md` §1 (Calculator philosophy), numeric
 * assertions use ±10–15 % tolerance or domain floors. Classification
 * (system name + pour_role) is exact.
 */

import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';
import { buildLaborProjection, K_UTIL, CURING_SHIFT_H } from './labor-projection.js';

describe('Golden — SO-202 D6 most na I/6 km 0,900', () => {
  describe('§5b Základ opěry OP1 (C25/30 XF1, ~35 m³ odhad, h=1.2m)', () => {
    const input: PlannerInput = {
      element_type: 'zaklady_piliru',
      volume_m3: 35,
      height_m: 1.2,
      has_dilatacni_spary: false,
      concrete_class: 'C25/30',
    };

    it('returns a plan without throwing', () => {
      const plan = planElement(input);
      expect(plan).toBeDefined();
      expect(plan.element.type).toBe('zaklady_piliru');
    });

    it('formwork system: Frami Xlife (rámové, pour_role=formwork) — Phase 3 RESOLVED per canonical §9.4', () => {
      const plan = planElement(input);
      // ✅ Phase 3 Gate 2a (commit 2 of 4) resolved: horizontal selector now
      // respects ELEMENT_CATALOG.recommended_formwork[0] over cheapest sort.
      // Frami Xlife is canonical for foundation elements per §9.4 + SO-202
      // §5b expected output + DOKA katalog. Top 50 (mostovka-class
      // nosníkové bednění) was previously chosen by cheapest-rental sort
      // because Frami Xlife (formwork_category='wall') was excluded from
      // the horizontal pool by ELEMENT_SUITABLE_CATEGORIES['horizontal'] =
      // {'slab', 'universal'}. Selector now bypasses pool filter when
      // recommended[0] is universal-applicable.
      expect(plan.formwork.system.name).toBe('Frami Xlife');
      expect(plan.formwork.system.pour_role).toBe('formwork');
      expect(plan.formwork.system.manufacturer).toBe('DOKA');
    });

    it('schedule: positive total_days', () => {
      const plan = planElement(input);
      expect(plan.schedule.total_days).toBeGreaterThan(0);
    });
  });

  describe('§5c Dřík opěry OP1 (C30/37 XF4, ~55 m³, h=5.0m)', () => {
    const input: PlannerInput = {
      element_type: 'opery_ulozne_prahy',
      volume_m3: 55,
      height_m: 5.0,
      has_dilatacni_spary: false,
      concrete_class: 'C30/37',
    };

    it('formwork system: TRIO (rámové, pour_role=formwork) — Phase 3 RESOLVED per canonical §9.4', () => {
      const plan = planElement(input);
      // ✅ Phase 3 Gate 2a (commit 3 of 4) resolved: vertical selector now
      // respects ELEMENT_CATALOG.recommended_formwork[0] AMONG pressure-
      // survivors. TRIO is canonical for opery_ulozne_prahy per §9.4 +
      // SO-202 §5c expected output (PERI rámové vertikální). COMAIN was
      // previously chosen by cheapest-among-pressure-survivors sort —
      // selector now bypasses cheapest-sort when canonical recommended[0]
      // survived pressure filter (DIN 18218 safety preserved).
      expect(plan.formwork.system.name).toBe('TRIO');
      expect(plan.formwork.system.pour_role).toBe('formwork');
    });
  });

  describe('§5f Mostovka NK — PDPS (C35/45 XF2, 693.35 m³/most, pevná skruž v 1 taktu)', () => {
    // PDPS-true input. Provenance:
    //   volume_m3 693.35      = VV 422336 (1 386.700 m³ oba mosty) ÷ 2  [VV]
    //   formwork_area 1209.78 = 10.85 × 111.5 m                         [TZ §1/§4]
    //   height 7.795          = výška nad terénem LM                    [TZ §1]
    //   C35/45 XF2, třída ošetřování 4                                  [TZ §2]
    //   12 kabelů, jednostranné napínání                                [TZ §4]
    //   1 takt: working_joints_allowed='no'                             [TZ §7.2, §6.11.3]
    //   span 20 / 6 polí (15+4×20+15)                                   [TZ §4]
    // Scope = ONE bridge (VV ÷ 2). num_bridges is deliberately NOT set:
    // the orchestrator multi-bridge branch (planner-orchestrator.ts §7)
    // treats volume_m3 as the BOTH-bridges total and splits it per bridge
    // — per-bridge scope models the single mega-pour the TZ prescribes.
    const input: PlannerInput = {
      element_type: 'mostovkova_deska',
      volume_m3: 693.35,
      formwork_area_m2: 1209.78,
      height_m: 7.795,
      nk_width_m: 10.85,
      has_dilatacni_spary: false,
      working_joints_allowed: 'no',
      concrete_class: 'C35/45',
      exposure_class: 'XF2',
      curing_class: 4,
      temperature_c: 15,
      bridge_deck_subtype: 'dvoutram',
      span_m: 20,
      num_spans: 6,
      construction_technology: 'fixed_scaffolding',
      is_prestressed: true,
      prestress_cables_count: 12,
      prestress_tensioning: 'one_sided',
      // VV 422365: 208.005 t B500B oba mosty ÷ 2 = 104.0 t per bridge
      // (= 150 kg/m³ — VV beats the engine's 100 kg/m³ prestressed-NK heuristic)
      rebar_mass_kg: 104000,
      // VV 422373: 38.420 t lan Y1860 oba mosty ÷ 2 = 19.21 t per bridge
      prestress_strand_mass_kg: 19210,
      // CN SAFE 26-027C: kontaktní plocha bednění NK 1 527.6 m²/most
      // (rozvinutá 13.7 × 111.5 vč. přesahů — ≠ půdorysná 1 209.775 m²)
      formwork_contact_area_m2: 1527.6,
    };

    it('classification: mostovkova_deska needs_supports', () => {
      const plan = planElement(input);
      expect(plan.element.type).toBe('mostovkova_deska');
      expect(plan.element.profile.needs_supports).toBe(true);
    });

    it('technology honored: fixed_scaffolding (TZ §7.2)', () => {
      const plan = planElement(input);
      expect(plan.bridge_technology?.technology).toBe('fixed_scaffolding');
      expect(plan.costs.is_mss_path).not.toBe(true);
    });

    it('PDPS pour mode: jeden takt — celá NK jednoho mostu = 1 záběr', () => {
      const plan = planElement(input);
      expect(plan.pour_decision.num_tacts).toBe(1);
      expect(plan.pour_decision.tact_volume_m3).toBeCloseTo(693.35, 1);
    });

    it('mega-pour: engine does NOT block, emits mega-pour warnings (backup pump, continuity)', () => {
      const plan = planElement(input);
      // 693 m³ continuous — backup pump mandatory + multi-pump consolidated line
      expect(plan.warnings.some(w => w.includes('MEGA zálivka'))).toBe(true);
      expect(plan.pour_decision.pumps_required).toBeGreaterThanOrEqual(2);
      expect(plan.pour_decision.backup_pump).toBe(true);
      // plan still produced — mega pour is a warning, not a gate
      expect(plan.schedule.total_days).toBeGreaterThan(0);
    });

    it('curing: třída ošetřování 4 — 9 d @15°C; seasonal skruž floor NOT applied (TZ §6.5.2)', () => {
      const plan = planElement(input);
      expect(plan.formwork.curing_days).toBeGreaterThanOrEqual(9);
      // STOP gate A decision (2026-06-11): for a PRESTRESSED deck the
      // ČSN 73 6244 seasonal table (podzim_jaro = 21 d) does NOT gate
      // odskružení — the gate is prestress completion. 21 would mean
      // the floor leaked back in.
      expect(plan.formwork.curing_days).toBeLessThan(21);
    });

    it('prestress: PDPS minimum — wait max(7, curing) + napínání + injektáž (TZ §6.5.2)', () => {
      const plan = planElement(input);
      expect(plan.prestress).toBeDefined();
      // 12 cables one-sided: wait 9 (curing tř. 4) + stressing 2 + grouting 2 = 13
      expect(plan.prestress!.days).toBeGreaterThanOrEqual(11);
      expect(plan.prestress!.days).toBeLessThanOrEqual(15);
      // skruž holds curing + prestress (odskružení po napnutí), not the
      // old double-floored 46 d
      expect(plan.prestress!.skruz_total_days).toBeLessThanOrEqual(25);
    });

    it('formwork system: Top 50 (formwork, nosnikove) — Gap #8 RESOLVED in Gate 2.1', () => {
      const plan = planElement(input);
      expect(plan.formwork.system.name).toBe('Top 50');
      expect(plan.formwork.system.pour_role).toBe('formwork');
      expect(plan.formwork.system.formwork_subtype).toBe('nosnikove');
      expect(plan.formwork.system.manufacturer).toBe('DOKA');
    });

    it('rebar: VV mass authoritative — 104.0 t B500B per bridge (150 kg/m³)', () => {
      const plan = planElement(input);
      // Profile ratio stays 150 (SSOT anchor); the prestressed-NK heuristic
      // would estimate 100 kg/m³, but the VV mass override (104 t) wins.
      expect(plan.element.profile.rebar_ratio_kg_m3).toBe(150);
      const totalRebarT = (plan.rebar.mass_kg * plan.pour_decision.num_tacts) / 1000;
      expect(totalRebarT).toBeCloseTo(104.0, 0);
    });

    it('§5f-Nh: ošetřování betonu spans the full curing period — 9 d → 36 Nh, not the compressed scheduler span (1.5 d)', () => {
      // STOP gate A finding resolved (2026-06-11, decision Alexander):
      // labor-projection days = max(schedule zrání span, curing_days).
      // PDPS 1 takt: tact_details zrání span is 1.5 d (scheduler-internal
      // compression), curing_days = 9 (třída ošetřování 4 @15 °C) → 9 wins.
      const plan = planElement(input);
      const labor = buildLaborProjection(plan);
      const osetrovani = labor.operations.find(op => op.key === 'osetrovani')!;
      expect(osetrovani).toBeDefined();
      expect(osetrovani.days).toBeCloseTo(plan.formwork.curing_days, 1);
      expect(osetrovani.norm_hours).toBeCloseTo(
        1 * CURING_SHIFT_H * K_UTIL * plan.formwork.curing_days, 1);
      // Regression guard against the old underestimated line (6.0 Nh)
      expect(osetrovani.norm_hours).toBeGreaterThanOrEqual(36);
    });

    it('§5f-Nh: CELKEM in the 8–12 Nh/m³ corridor [normy potvrzené Alexander + CN SAFE implied]', () => {
      const plan = planElement(input);
      const labor = buildLaborProjection(plan);
      const nhPerM3 = labor.total_norm_hours / 693.35;
      expect(nhPerM3).toBeGreaterThanOrEqual(8);
      expect(nhPerM3).toBeLessThanOrEqual(12);
      // Component sanity (±15 % philosophy not needed — norms are exact data):
      // skruž + bednění = 3.1 Nh/m² × 1 527.6 m² kontakt ≈ 4 735.6 Nh
      const fwNh = labor.operations
        .filter(op => ['bedneni_montaz', 'bedneni_demontaz', 'podpery'].includes(op.key))
        .reduce((s, op) => s + op.norm_hours, 0);
      expect(fwNh).toBeCloseTo(4735.6, 0);
      // betonáž v koridoru 0.5–0.6 Nh/m³ (24 os. × V/35 m³/h × 0.8)
      const beton = labor.operations.find(op => op.key === 'beton')!;
      expect(beton.norm_hours / 693.35).toBeGreaterThanOrEqual(0.5);
      expect(beton.norm_hours / 693.35).toBeLessThanOrEqual(0.6);
    });
  });

  describe('§5f-SYN Mostovka — SYNTETIKA 6 taktů (NOT PDPS — multi-takt stress-test)', () => {
    // ⚠️ NOT PDPS. TZ §7.2 prescribes betonáž v JEDNOM taktu (see §5f above).
    // This 6-tact input is kept ONLY as a synthetic stress-test of the
    // multi-tact scheduling logic until the Žalmanov golden (Part C, real
    // PDPS 3-tact bridge) lands — then this block is scheduled for removal.
    const input: PlannerInput = {
      element_type: 'mostovkova_deska',
      volume_m3: 605, // odhad (synthetic) — PDPS volume is 693.35 (VV 422336 ÷ 2)
      formwork_area_m2: 1209.78,
      height_m: 7.795,
      has_dilatacni_spary: false,
      concrete_class: 'C30/37',
      span_m: 20,
      num_spans: 6,
    };

    it('multi-takt path still produces a plan with >1 tact', () => {
      const plan = planElement(input);
      expect(plan.element.type).toBe('mostovkova_deska');
      expect(plan.pour_decision.num_tacts).toBeGreaterThan(1);
      expect(plan.schedule.total_days).toBeGreaterThan(0);
    });

    it('formwork system stays Top 50 on the synthetic input too', () => {
      const plan = planElement(input);
      expect(plan.formwork.system.name).toBe('Top 50');
      expect(plan.formwork.system.pour_role).toBe('formwork');
    });
  });
});
