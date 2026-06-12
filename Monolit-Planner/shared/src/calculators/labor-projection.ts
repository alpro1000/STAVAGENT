/**
 * labor-projection — single-source projection of a calculator plan onto the
 * position carrier (metadata.schedule_info + TOV labor entries).
 *
 * Seam fix (2026-06): the calculator summary, the Aplikovat writer and the
 * Monolit Planner summary readers (FlatGantt, FlatKPIPanel, ElementBlock,
 * backend XLSX exporter) previously each derived person-hours and durations
 * with their own formulas. This module is now the ONLY place where the
 * canonical numbers are built; everything else projects them.
 *
 * Domain decisions (fixed):
 *   - Normohodina (canon)  = crew × shift × K_UTIL(0.8) × days. Used for
 *     efficiency, norm reconciliation and durations.
 *   - Confirmed productivity norms (LABOR_NORMS, data with provenance)
 *     override the canon for Nh when their basis inputs are present
 *     (armování Nh/t, předpětí Nh/t lan, skruž+bednění Nh/m² kontakt,
 *     betonáž mega-pour crew model). Days ALWAYS stay with the scheduler —
 *     norms never move the schedule.
 *   - Presence hours       = normohodiny / 0.8 (crew × shift × days).
 *   - Money is ALWAYS paid on presence (a 10h shift is paid in full).
 *   - Ošetřovatel betonu (1 person × ~5 h/day over max(schedule zrání span,
 *     curing_days)) is part of the element's person-hours as a VISIBLE
 *     "ošetřování betonu" line.
 *   - Zrání is a calendar span, never a sequential work addend.
 */

import type { PlannerOutput } from './planner-orchestrator.js';
import { aggregateScheduleDays } from '../formulas.js';
import type { StructuralElementType } from './pour-decision.js';
import { LABOR_NORMS } from './labor-norms.js';

/** Time utilization factor: norm hours = presence hours × K_UTIL. */
export const K_UTIL = 0.8;

/** Ošetřovatel betonu — 1 person, ~5 h/day (3× kropení + zakrytí). */
export const CURING_SHIFT_H = 5;

/**
 * Elements that don't use system formwork at all (pažnice / tremie pipe /
 * guide walls). No bednění / odbednění operations are projected for them.
 */
export const NO_FORMWORK_ELEMENTS: ReadonlySet<StructuralElementType> =
  new Set<StructuralElementType>(['pilota', 'podzemni_stena']);

const round1 = (v: number) => Math.round(v * 10) / 10;

// ─── Schedule projection (metadata.schedule_info) ───────────────────────────

/**
 * One Gantt phase. Shape matches what FlatGantt.tsx and exporter.js already
 * expect from `metadata.schedule_info.phases` (previously a dead branch):
 * `start_day` is a 0-based offset from the element start, `duration` in
 * working days. Overlapping phases (curing under next-tact assembly) keep
 * their real intervals — readers must NOT sum them sequentially.
 */
export interface SchedulePhaseProjection {
  /** Position subtype the phase maps to (bednění / výztuž / beton / zrání / odbednění / předpětí) */
  subtype: string;
  /** Display label, e.g. "Záběr 2 — výztuž" */
  name: string;
  /** 0-based offset from element start (working days) */
  start_day: number;
  /** Duration in working days */
  duration: number;
  /** 1-based tact number the phase belongs to */
  tact: number;
}

export interface ScheduleProjection {
  /** Engine total (RCPSP critical path) — THE element duration */
  total_days: number;
  tact_count: number;
  /** Real phase intervals with overlaps. Omitted when the engine produced no tact details. */
  phases?: SchedulePhaseProjection[];
}

const PHASE_SUBTYPES = [
  ['assembly', 'bednění', 'montáž bednění'],
  ['rebar', 'výztuž', 'výztuž'],
  ['concrete', 'beton', 'betonáž'],
  ['curing', 'zrání', 'zrání'],
  ['relocate', 'bednění', 'přesun bednění'],
  ['stripping', 'odbednění', 'demontáž bednění'],
  ['prestress', 'předpětí', 'předpětí'],
] as const;

/** Build the schedule projection persisted as `metadata.schedule_info`. */
export function buildScheduleProjection(plan: PlannerOutput): ScheduleProjection {
  const tacts = plan.schedule.tact_details || [];
  const projection: ScheduleProjection = {
    total_days: plan.schedule.total_days,
    tact_count: plan.pour_decision.num_tacts,
  };
  if (tacts.length === 0) return projection;

  const phases: SchedulePhaseProjection[] = [];
  for (const t of tacts) {
    for (const [key, subtype, label] of PHASE_SUBTYPES) {
      const span = (t as unknown as Record<string, [number, number] | undefined>)[key];
      if (!span) continue;
      const duration = round1(span[1] - span[0]);
      if (duration <= 0) continue;
      phases.push({
        subtype,
        name: `Záběr ${t.tact} — ${label}`,
        start_day: round1(span[0]),
        duration,
        tact: t.tact,
      });
    }
  }
  if (phases.length > 0) projection.phases = phases;
  return projection;
}

// ─── Labor projection (canonical person-hours per operation) ────────────────

export type LaborOperationKey =
  | 'beton'
  | 'bedneni_montaz'
  | 'bedneni_demontaz'
  | 'vyztuz'
  | 'osetrovani'
  | 'podpery'
  | 'predpeti'
  // pile path
  | 'vrtani'
  | 'armokose'
  | 'uprava_hlavy'
  | 'hlavice';

export interface LaborOperationProjection {
  key: LaborOperationKey;
  /** Czech label as shown in summaries / TOV */
  label_cs: string;
  /** Crew headcount used in the canon formula */
  crew: number;
  /** Shift hours used in the canon formula */
  shift_h: number;
  /** Days the operation occupies (labor-days from the real schedule) */
  days: number;
  /** Canonical normohodiny = crew × shift × K_UTIL × days */
  norm_hours: number;
  /** Presence hours = norm_hours / K_UTIL — the paid hours */
  presence_hours: number;
  /** Provenance when norm_hours comes from a confirmed norm (LABOR_NORMS)
   *  instead of the crew × shift × K_UTIL × days canon. */
  norm_source?: string;
}

export interface LaborProjection {
  operations: LaborOperationProjection[];
  /** Σ norm_hours — THE canonical person-hours of the element */
  total_norm_hours: number;
  /** Σ presence_hours — the paid hours */
  total_presence_hours: number;
}

function makeOp(
  key: LaborOperationKey,
  label_cs: string,
  crew: number,
  shift_h: number,
  days: number,
): LaborOperationProjection {
  const norm = round1(crew * shift_h * K_UTIL * days);
  return {
    key,
    label_cs,
    crew,
    shift_h,
    days: round1(days),
    norm_hours: norm,
    presence_hours: round1(norm / K_UTIL),
  };
}

/** Norm-hours-first variant: norm hours come from a confirmed norm or the
 *  engine (props) instead of the canon formula. Days stay from the schedule. */
function makeOpFromNorm(
  key: LaborOperationKey,
  label_cs: string,
  crew: number,
  shift_h: number,
  days: number,
  norm_hours: number,
  norm_source?: string,
): LaborOperationProjection {
  const norm = round1(norm_hours);
  return {
    key,
    label_cs,
    crew,
    shift_h,
    days: round1(days),
    norm_hours: norm,
    presence_hours: round1(norm / K_UTIL),
    ...(norm_source ? { norm_source } : {}),
  };
}

/**
 * Build the canonical per-operation labor breakdown of a plan.
 * Day counts come from the REAL schedule (aggregateScheduleDays over
 * tact_details — the same source Aplikovat persists into position `days`).
 */
export function buildLaborProjection(plan: PlannerOutput): LaborProjection {
  const operations: LaborOperationProjection[] = [];
  const shift = plan.resources.shift_h;

  if (plan.element.type === 'pilota' && plan.pile) {
    // Pile path mirrors buildPileWorkDrafts: rig crew, armokoše, kontraktor
    // pour, head adjustment, optional cap.
    const pile = plan.pile;
    if (pile.drilling_days > 0) {
      operations.push(makeOp('vrtani', 'vrtání', 2, shift, pile.drilling_days));
      operations.push(makeOp('beton', 'betonáž piloty (kontraktor)', 2, shift, pile.drilling_days));
    }
    if (pile.rebar_total_kg > 0) {
      operations.push(makeOp('armokose', 'armokoše', 2, shift, pile.drilling_days));
    }
    if (pile.head_adjustment_days > 0) {
      operations.push(makeOp('uprava_hlavy', 'úprava hlav', 2, shift, pile.head_adjustment_days));
    }
    if (pile.pile_cap_days != null && pile.pile_cap_days > 0) {
      operations.push(makeOp('hlavice', 'hlavice piloty', 4, shift, pile.pile_cap_days));
    }
  } else {
    const tacts = plan.schedule.tact_details || [];
    const numTacts = plan.pour_decision.num_tacts || 1;
    const agg = aggregateScheduleDays(tacts, {
      numTacts,
      assemblyDaysPerTact: plan.formwork.assembly_days,
      rebarDaysPerTact: plan.rebar.duration_days,
      concreteDaysPerTact: 1,
      curingDays: plan.formwork.curing_days,
      strippingDaysPerTact: plan.formwork.disassembly_days,
      prestressDaysPerTact: plan.prestress?.days,
    });

    const fwCrew = plan.resources.crew_size_formwork;
    const rbCrew = plan.resources.crew_size_rebar;
    const hasFormwork = !NO_FORMWORK_ELEMENTS.has(plan.element.type);

    if (agg.beton > 0) {
      // Mega-pour crew model (confirmed norm): when the engine pour needs a
      // pump tandem, Nh = (12 os./linku × pump_lines) × (V / tandem rate mid)
      // × K_UTIL. Crew relief at pour > 12 h stays armed engine-side —
      // on-site headcount is constant, so Nh does not double.
      const pourModel = LABOR_NORMS.betonaz_crew_model.value;
      const totalVolume = plan.tact_volumes
        ? plan.tact_volumes.reduce((s, v) => s + v, 0)
        : plan.pour_decision.tact_volume_m3 * numTacts;
      if (plan.pour_decision.pumps_required >= pourModel.pump_lines && totalVolume > 0) {
        const rateMid = (pourModel.effective_rate_m3h_min + pourModel.effective_rate_m3h_max) / 2;
        const crewOnSite = pourModel.crew_per_pump_line * pourModel.pump_lines;
        const pourHours = totalVolume / rateMid;
        operations.push(makeOpFromNorm(
          'beton', 'betonáž', crewOnSite, shift, agg.beton,
          crewOnSite * pourHours * K_UTIL,
          LABOR_NORMS.betonaz_crew_model.source,
        ));
      } else {
        operations.push(makeOp('beton', 'betonáž', fwCrew, shift, agg.beton));
      }
    }

    // Skruž + bednění (confirmed norm): when the KONTAKTNÍ plocha is known,
    // total Nh = 3.1 Nh/m² × contact area, distributed over the formwork
    // operations (montáž / demontáž / podpěry) proportionally to their
    // schedule days. Fallback: per-operation canon.
    const contactAreaM2 = plan.formwork.contact_area_m2 ?? 0;
    const propsDays = plan.props?.needed && plan.props.labor_hours > 0
      ? plan.props.assembly_days + plan.props.disassembly_days
      : 0;
    const fwShares: Array<[LaborOperationKey, string, number]> = [];
    if (agg.bedneni > 0 && hasFormwork) fwShares.push(['bedneni_montaz', 'montáž bednění', agg.bedneni]);
    if (agg.odbedneni > 0 && hasFormwork) fwShares.push(['bedneni_demontaz', 'demontáž bednění', agg.odbedneni]);
    if (propsDays > 0) fwShares.push(['podpery', 'podpěrná konstrukce', propsDays]);
    const fwShareDays = fwShares.reduce((s, [, , d]) => s + d, 0);

    if (contactAreaM2 > 0 && hasFormwork && fwShareDays > 0) {
      const totalFwNh = LABOR_NORMS.skruz_bedneni_nh_per_m2_kontakt.value * contactAreaM2;
      for (const [key, label, days] of fwShares) {
        operations.push(makeOpFromNorm(
          key, label, fwCrew, shift, days,
          totalFwNh * (days / fwShareDays),
          LABOR_NORMS.skruz_bedneni_nh_per_m2_kontakt.source,
        ));
      }
    } else {
      if (agg.bedneni > 0 && hasFormwork) {
        operations.push(makeOp('bedneni_montaz', 'montáž bednění', fwCrew, shift, agg.bedneni));
      }
      if (agg.odbedneni > 0 && hasFormwork) {
        operations.push(makeOp('bedneni_demontaz', 'demontáž bednění', fwCrew, shift, agg.odbedneni));
      }
    }

    if (agg.vyztuž > 0) {
      // Armování (confirmed norm): Nh = 18 Nh/t × rebar mass. Mass is always
      // known from the engine (per-tact mass × tacts); canon stays as the
      // zero-mass fallback.
      const rebarMassT = (plan.rebar.mass_kg * numTacts) / 1000;
      if (rebarMassT > 0) {
        operations.push(makeOpFromNorm(
          'vyztuz', 'výztuž', rbCrew, shift, agg.vyztuž,
          LABOR_NORMS.armovani_nh_per_t.value * rebarMassT,
          LABOR_NORMS.armovani_nh_per_t.source,
        ));
      } else {
        operations.push(makeOp('vyztuz', 'výztuž', rbCrew, shift, agg.vyztuž));
      }
    }
    // Visible "ošetřování betonu" line — part of the element's person-hours,
    // never smeared into betonáž. Days = max(calendar span of curing from the
    // schedule, curing_days): tact_details can underestimate the span when the
    // scheduler compresses the zrání phase (SO-202 PDPS: span 1.5 d vs
    // curing_days 9), while a multi-tact calendar span can legitimately
    // exceed curing_days — the ošetřovatel is on site for the longer of the two.
    const curingBase = Math.max(agg.zrani, plan.formwork.curing_days || 0);
    if (curingBase > 0) {
      operations.push(makeOp('osetrovani', 'ošetřování betonu', 1, CURING_SHIFT_H, curingBase));
    }
    if (propsDays > 0 && !(contactAreaM2 > 0 && hasFormwork && fwShareDays > 0)) {
      // Engine props norm — only when the skruž+bednění contact-area norm
      // didn't already cover podpěry in the distribution above.
      operations.push(makeOpFromNorm(
        'podpery', 'podpěrná konstrukce',
        fwCrew, shift,
        propsDays,
        plan.props!.labor_hours,
      ));
    }
    if (plan.prestress && (agg.predpeti > 0 || plan.prestress.days > 0)) {
      const prDays = agg.predpeti || round1(plan.prestress.days * numTacts);
      // Předpětí (confirmed norm): Nh = 35 Nh/t × strand mass (Y1860) when
      // the mass is known (e.g. from VV); canon fallback otherwise.
      const strandT = (plan.prestress.strand_mass_kg ?? 0) / 1000;
      if (strandT > 0) {
        operations.push(makeOpFromNorm(
          'predpeti', 'předpětí', plan.prestress.crew_size || 5, shift, prDays,
          LABOR_NORMS.predpeti_nh_per_t.value * strandT,
          LABOR_NORMS.predpeti_nh_per_t.source,
        ));
      } else {
        operations.push(makeOp('predpeti', 'předpětí', plan.prestress.crew_size || 5, shift, prDays));
      }
    }
  }

  return {
    operations,
    total_norm_hours: round1(operations.reduce((s, op) => s + op.norm_hours, 0)),
    total_presence_hours: round1(operations.reduce((s, op) => s + op.presence_hours, 0)),
  };
}
