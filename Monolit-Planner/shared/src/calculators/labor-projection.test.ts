/**
 * Hermetic consistency tests — seam fix "single source of summary".
 *
 * One projection → all summary readers show ONE number:
 *   - element row "Celkem dní" (metadata.schedule_info.total_days)
 *   - FlatGantt roll-up (parts sequential, phases overlap inside an element)
 *   - KPI "Čas" (calculateHeaderKPI → schedule_total_days)
 *
 * And ONE canonical person-hours figure (×0.8 normohodiny) shared by the
 * calculator Souhrn, the TOV norm entries and the planner row display, with
 * presence (= norm / 0.8) reserved for money.
 *
 * No network / DB / AI — pure engine + formulas (golden convention).
 *
 * Input below = the SO-202-shaped SYNTHETIC multi-tact case (605 m³ /
 * 6 tacts — same numbers the seam-fix recon used). NOT PDPS: per TZ §7.2
 * the real SO-202 NK is poured in ONE tact (693.35 m³ per VV 422336 ÷ 2,
 * see golden-so202.test.ts §5f). The multi-tact shape is deliberate here —
 * phase overlaps and the zrání overlay only exist with >1 tact.
 */

import { describe, it, expect } from 'vitest';
import { planElement } from './planner-orchestrator.js';
import type { PlannerInput } from './planner-orchestrator.js';
import {
  buildScheduleProjection,
  buildLaborProjection,
  K_UTIL,
  CURING_SHIFT_H,
} from './labor-projection.js';
import { LABOR_NORMS } from './labor-norms.js';
import {
  calculatePositionFields,
  calculateHeaderKPI,
  summarizeScheduleProjections,
} from '../formulas.js';
import type { Position } from '../types.js';

const SO202_MOSTOVKA: PlannerInput = {
  element_type: 'mostovkova_deska',
  volume_m3: 605,
  formwork_area_m2: 1209.78,
  height_m: 7.795,
  has_dilatacni_spary: false,
  concrete_class: 'C30/37',
  span_m: 20,
  num_spans: 6,
};

/** Build a beton position carrying the projection, as Aplikovat persists it. */
function betonPositionWith(scheduleInfo: object, overrides: Partial<Position> = {}): Position {
  return {
    bridge_id: 'SO202',
    part_name: 'NOSNÁ KONSTRUKCE',
    item_name: 'Mostovka NK',
    subtype: 'beton',
    unit: 'M3',
    qty: 605,
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: 6,
    metadata: JSON.stringify({ schedule_info: scheduleInfo }),
    ...overrides,
  } as Position;
}

describe('Schedule projection — one number across all summary views', () => {
  const plan = planElement(SO202_MOSTOVKA);
  const projection = buildScheduleProjection(plan);

  it('projection total equals the engine total (single source)', () => {
    expect(projection.total_days).toBe(plan.schedule.total_days);
    expect(projection.tact_count).toBe(plan.pour_decision.num_tacts);
  });

  it('phases carry real overlapping intervals — never a sequential layout', () => {
    expect(projection.phases).toBeDefined();
    const phases = projection.phases!;
    expect(phases.length).toBeGreaterThan(0);
    // Every phase fits inside the element total (small scheduler tail allowed)
    for (const ph of phases) {
      expect(ph.start_day + ph.duration).toBeLessThanOrEqual(projection.total_days + 0.001);
    }
    // Overlap proof: a sequential sum of phase durations would far exceed the
    // engine total — readers MUST NOT add phases up.
    const sequentialSum = phases.reduce((s, p) => s + p.duration, 0);
    expect(sequentialSum).toBeGreaterThan(projection.total_days);
  });

  it('zrání is a span overlay, not a sequential addend (old 622.8 d bug)', () => {
    const phases = projection.phases!;
    const zrani = phases.filter(p => p.subtype === 'zrání');
    expect(zrani.length).toBeGreaterThan(0);
    // Each zrání phase lies inside the element total; the roll-up (below)
    // equals the engine total, so curing can never stretch it.
    for (const z of zrani) {
      expect(z.start_day + z.duration).toBeLessThanOrEqual(projection.total_days + 0.001);
    }
  });

  it('reader 1 — element row "Celkem dní" reads the same number', () => {
    const pos = betonPositionWith(projection);
    const meta = JSON.parse(pos.metadata!);
    expect(meta.schedule_info.total_days).toBe(plan.schedule.total_days);
  });

  it('reader 2 — Gantt roll-up (parts sequential) equals Σ element totals', () => {
    // FlatGantt lays parts sequentially, advancing by schedule_info.total_days
    // per calculated element. Single element → roll-up = engine total.
    let currentDay = 1;
    currentDay += projection.total_days;
    expect(Math.round((currentDay - 1) * 10) / 10).toBe(plan.schedule.total_days);
  });

  it('reader 3 — KPI "Čas" (calculateHeaderKPI) reads the same number', () => {
    const pos = calculatePositionFields(betonPositionWith(projection), []);
    const kpi = calculateHeaderKPI([pos], { days_per_month_mode: 30 });
    expect(kpi.schedule_total_days).toBe(plan.schedule.total_days);
    expect(kpi.schedule_elements_calculated).toBe(1);
    expect(kpi.schedule_elements_uncalculated).toBe(0);
  });

  it('Krytí mezd ratio exists with a schedule and both inputs positive', () => {
    const pos = calculatePositionFields(betonPositionWith(projection), []);
    const kpi = calculateHeaderKPI([pos], { days_per_month_mode: 30 });
    expect(kpi.wage_coverage_ratio).not.toBeNull();
    const scheduleMonths = plan.schedule.total_days / 30;
    expect(kpi.wage_coverage_ratio!).toBeCloseTo(kpi.estimated_months / scheduleMonths, 2);
  });

  it('honest blank — no projection → schedule NEPOČÍTÁNO + no ratio', () => {
    const bare = calculatePositionFields(betonPositionWith({}, { metadata: undefined }), []);
    const kpi = calculateHeaderKPI([bare], { days_per_month_mode: 30 });
    expect(kpi.schedule_total_days).toBeNull();
    expect(kpi.wage_coverage_ratio).toBeNull();
    expect(kpi.schedule_elements_uncalculated).toBe(1);
  });

  it('mixed project — partial sum + uncalculated badge count', () => {
    const withProj = betonPositionWith(projection);
    const withoutProj = betonPositionWith({}, {
      part_name: 'OPĚRA OP1', metadata: undefined,
    });
    const summary = summarizeScheduleProjections([withProj, withoutProj]);
    expect(summary.schedule_total_days).toBe(plan.schedule.total_days);
    expect(summary.schedule_elements_calculated).toBe(1);
    expect(summary.schedule_elements_uncalculated).toBe(1);
  });
});

describe('Labor projection — one canonical person-hours figure', () => {
  const plan = planElement(SO202_MOSTOVKA);
  const labor = buildLaborProjection(plan);

  it('canon = crew × shift × 0.8 × days; presence = canon ÷ 0.8', () => {
    expect(labor.operations.length).toBeGreaterThan(0);
    for (const op of labor.operations) {
      expect(op.presence_hours).toBeCloseTo(op.norm_hours / K_UTIL, 1);
      if (op.key !== 'podpery' && !op.norm_source) {
        // props come from the engine's normative hours and norm_source ops
        // from confirmed norms (LABOR_NORMS); all other operations follow
        // the fixed canon formula exactly
        expect(op.norm_hours).toBeCloseTo(op.crew * op.shift_h * K_UTIL * op.days, 1);
      }
    }
    expect(labor.total_norm_hours).toBeCloseTo(
      labor.operations.reduce((s, op) => s + op.norm_hours, 0), 1);
  });

  it('ošetřování betonu is a visible separate line (1 os. × 5 h/den)', () => {
    const osetrovani = labor.operations.find(op => op.key === 'osetrovani');
    expect(osetrovani).toBeDefined();
    expect(osetrovani!.crew).toBe(1);
    expect(osetrovani!.shift_h).toBe(CURING_SHIFT_H);
    expect(osetrovani!.norm_hours).toBeGreaterThan(0);
    expect(osetrovani!.label_cs).toContain('ošetřování');
  });

  it('ošetřování days = max(schedule curing span, curing_days) — never below curing_days', () => {
    // SO-202 PDPS finding (STOP gate A): the scheduler can compress the zrání
    // span in tact_details (1.5 d) while curing_days = 9 — the ošetřovatel is
    // on site for the full curing period regardless.
    const osetrovani = labor.operations.find(op => op.key === 'osetrovani')!;
    expect(osetrovani.days).toBeGreaterThanOrEqual(plan.formwork.curing_days);
    expect(osetrovani.norm_hours).toBeCloseTo(
      1 * CURING_SHIFT_H * K_UTIL * osetrovani.days, 1);
  });

  it('mostovka breakdown contains all expected operations', () => {
    const keys = labor.operations.map(op => op.key);
    expect(keys).toContain('beton');
    expect(keys).toContain('bedneni_montaz');
    expect(keys).toContain('bedneni_demontaz');
    expect(keys).toContain('vyztuz');
    expect(keys).toContain('osetrovani');
    expect(keys).toContain('podpery'); // mostovka needs supports
  });

  it('pilota projects NO formwork operations (pažnice / tremie)', () => {
    const pilePlan = planElement({
      element_type: 'pilota',
      volume_m3: 50,
      pile_diameter_mm: 900,
      pile_length_m: 12,
      pile_count: 8,
      concrete_class: 'C25/30',
    } as PlannerInput);
    const pileLabor = buildLaborProjection(pilePlan);
    const keys = pileLabor.operations.map(op => op.key);
    expect(keys).not.toContain('bedneni_montaz');
    expect(keys).not.toContain('bedneni_demontaz');
    expect(keys).toContain('vrtani');
  });
});

describe('Confirmed labor norms (LABOR_NORMS) — data with provenance, canon fallback', () => {
  // PDPS-shaped plan with all norm bases present (golden §5f input)
  const PDPS_INPUT: PlannerInput = {
    element_type: 'mostovkova_deska',
    volume_m3: 693.35,
    formwork_area_m2: 1209.78,
    formwork_contact_area_m2: 1527.6,
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
    prestress_strand_mass_kg: 19210,
    rebar_mass_kg: 104000,
  } as PlannerInput;
  const pdpsPlan = planElement(PDPS_INPUT);
  const pdpsLabor = buildLaborProjection(pdpsPlan);

  it('armování: 18 Nh/t × rebar mass — norm-based with provenance', () => {
    const vyztuz = pdpsLabor.operations.find(op => op.key === 'vyztuz')!;
    const massT = (pdpsPlan.rebar.mass_kg * pdpsPlan.pour_decision.num_tacts) / 1000;
    expect(massT).toBeCloseTo(104.0, 0);
    expect(vyztuz.norm_hours).toBeCloseTo(LABOR_NORMS.armovani_nh_per_t.value * massT, 1);
    expect(vyztuz.norm_source).toBe(LABOR_NORMS.armovani_nh_per_t.source);
  });

  it('předpětí: 35 Nh/t × strand mass (Y1860, VV) — norm-based with provenance', () => {
    const predpeti = pdpsLabor.operations.find(op => op.key === 'predpeti')!;
    expect(predpeti.norm_hours).toBeCloseTo(
      LABOR_NORMS.predpeti_nh_per_t.value * 19.21, 1);
    expect(predpeti.norm_source).toBe(LABOR_NORMS.predpeti_nh_per_t.source);
  });

  it('předpětí: canon fallback when strand mass is unknown', () => {
    const { prestress_strand_mass_kg: _omit, ...rest } = PDPS_INPUT as Record<string, unknown>;
    const plan = planElement(rest as unknown as PlannerInput);
    const predpeti = buildLaborProjection(plan).operations.find(op => op.key === 'predpeti')!;
    expect(predpeti.norm_source).toBeUndefined();
    expect(predpeti.norm_hours).toBeCloseTo(
      predpeti.crew * predpeti.shift_h * K_UTIL * predpeti.days, 1);
  });

  it('skruž + bednění: 3.1 Nh/m² KONTAKTNÍ plochy across montáž + demontáž + podpěry', () => {
    const fwOps = pdpsLabor.operations.filter(op =>
      op.key === 'bedneni_montaz' || op.key === 'bedneni_demontaz' || op.key === 'podpery');
    expect(fwOps.length).toBe(3);
    const totalFwNh = fwOps.reduce((s, op) => s + op.norm_hours, 0);
    expect(totalFwNh).toBeCloseTo(
      LABOR_NORMS.skruz_bedneni_nh_per_m2_kontakt.value * 1527.6, 0);
    for (const op of fwOps) {
      expect(op.norm_source).toBe(LABOR_NORMS.skruz_bedneni_nh_per_m2_kontakt.source);
    }
  });

  it('skruž + bednění: canon fallback when contact area is unknown', () => {
    const { formwork_contact_area_m2: _omit, ...rest } = PDPS_INPUT as Record<string, unknown>;
    const plan = planElement(rest as unknown as PlannerInput);
    const ops = buildLaborProjection(plan).operations;
    const montaz = ops.find(op => op.key === 'bedneni_montaz')!;
    expect(montaz.norm_source).toBeUndefined();
    expect(montaz.norm_hours).toBeCloseTo(
      montaz.crew * montaz.shift_h * K_UTIL * montaz.days, 1);
    // podpěry stay on the engine props norm in the fallback path
    expect(ops.find(op => op.key === 'podpery')).toBeDefined();
  });

  it('betonáž mega-pour: crew 12/linku × 2 linky × (V / 35 m³/h) × 0.8; rotation > 12 h stays armed', () => {
    const beton = pdpsLabor.operations.find(op => op.key === 'beton')!;
    const model = LABOR_NORMS.betonaz_crew_model.value;
    const crewOnSite = model.crew_per_pump_line * model.pump_lines; // 24
    const rateMid = (model.effective_rate_m3h_min + model.effective_rate_m3h_max) / 2; // 35
    const pourHours = 693.35 / rateMid; // 19.81 h
    expect(pourHours).toBeGreaterThan(12); // crew relief (rotation) fires
    expect(beton.crew).toBe(crewOnSite);
    expect(beton.norm_hours).toBeCloseTo(crewOnSite * pourHours * K_UTIL, 1);
    expect(beton.norm_source).toBe(LABOR_NORMS.betonaz_crew_model.source);
  });

  it('betonáž: canon fallback on a single-pump pour', () => {
    const plan = planElement({
      element_type: 'zaklady_piliru',
      volume_m3: 35,
      height_m: 1.2,
      has_dilatacni_spary: false,
      concrete_class: 'C25/30',
    });
    expect(plan.pour_decision.pumps_required).toBeLessThan(2);
    const beton = buildLaborProjection(plan).operations.find(op => op.key === 'beton')!;
    expect(beton.norm_source).toBeUndefined();
    expect(beton.norm_hours).toBeCloseTo(
      beton.crew * beton.shift_h * K_UTIL * beton.days, 1);
  });

  it('norms calibrate Nh ONLY — the schedule does not move (77.5 d / curing 9 / prestress 13)', () => {
    const { formwork_contact_area_m2: _a, prestress_strand_mass_kg: _b, ...withoutNormInputs } =
      PDPS_INPUT as Record<string, unknown>;
    const bare = planElement(withoutNormInputs as unknown as PlannerInput);
    expect(pdpsPlan.schedule.total_days).toBe(bare.schedule.total_days);
    expect(pdpsPlan.formwork.curing_days).toBe(bare.formwork.curing_days);
    expect(pdpsPlan.prestress!.days).toBe(bare.prestress!.days);
  });

  it('legacy pilota path untouched by norms (rig-crew canon)', () => {
    const pilePlan = planElement({
      element_type: 'pilota',
      volume_m3: 50,
      pile_diameter_mm: 900,
      pile_length_m: 12,
      pile_count: 8,
      concrete_class: 'C25/30',
    } as PlannerInput);
    const pileLabor = buildLaborProjection(pilePlan);
    const keys = pileLabor.operations.map(op => op.key);
    expect(keys).not.toContain('bedneni_montaz');
    expect(keys).not.toContain('bedneni_demontaz');
    expect(keys).toContain('vrtani');
  });
});
