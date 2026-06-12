/**
 * labor-norms — confirmed labor productivity norms as DATA with provenance.
 *
 * Convention (TASK_Orchestrator_WorkOntology_SO202_Bridge): norms are data
 * records each carrying its source — NOT constants buried in formulas. The
 * labor projection consumes them when the required inputs are present and
 * falls back to the crew × shift × K_UTIL × days canon otherwise.
 *
 * Schedule is NEVER derived from these norms — they calibrate person-hours
 * (Nh) only; durations stay with the engine scheduler.
 */

export interface LaborNormRecord<T> {
  value: T;
  /** Provenance of the norm — verbatim source tag for audit trails. */
  source: string;
}

/** Mega-pour crew model: one complete pour crew per pump line. */
export interface PourCrewModel {
  /** Persons per pump line (ukládka 4 + vibrace 3 + finiš 2 + čerpadlo/koordinace 3) */
  crew_per_pump_line: number;
  breakdown: {
    ukladka: number;
    vibrace: number;
    finis: number;
    cerpadlo_koordinace: number;
  };
  /** Pump lines on a mega-pour (tandem; PDK — záložní line manned) */
  pump_lines: number;
  /** Effective TANDEM throughput (m³/h) — domíchávač logistics limited,
   *  not nominal pump capacity. Projection uses the midpoint. */
  effective_rate_m3h_min: number;
  effective_rate_m3h_max: number;
}

const SOURCE_ALEXANDER = 'normy potvrzené Alexander, 2026-06';

export const LABOR_NORMS = {
  /** Vázání betonářské výztuže B500B — Nh per tonne. In line with
   *  REBAR_RATES_MATRIX (walls D12 ≈ 17.3 h/t). */
  armovani_nh_per_t: {
    value: 18,
    source: SOURCE_ALEXANDER,
  } as LaborNormRecord<number>,

  /** Předpínací systém (osazení + napínání + injektáž) — Nh per tonne
   *  předpínacích lan (Y1860). Applied only when strand mass is known. */
  predpeti_nh_per_t: {
    value: 35,
    source: SOURCE_ALEXANDER,
  } as LaborNormRecord<number>,

  /** Skruž + bednění (montáž + demontáž vč. podpěrné konstrukce) — Nh per m²
   *  KONTAKTNÍ plochy bednění (rozvinutá plocha, ne půdorys). Applied only
   *  when the contact area is known (e.g. SO-202: 1 527.6 m² [CN SAFE]). */
  skruz_bedneni_nh_per_m2_kontakt: {
    value: 3.1,
    source: `${SOURCE_ALEXANDER} (plocha kontaktní: CN SAFE implied)`,
  } as LaborNormRecord<number>,

  /** Betonáž mega-pour crew model: čета 12/linku × 2 čerpadlové linky =
   *  24 os. on site; tandem effective 30–40 m³/h → hours = V / rate_mid;
   *  Nh = crew × hours × K_UTIL. Crew relief (rotation) at pour > 12 h
   *  stays armed engine-side — headcount on site is constant, so Nh does
   *  not double. Applied when the engine pour needs ≥ pump_lines pumps. */
  betonaz_crew_model: {
    value: {
      crew_per_pump_line: 12,
      breakdown: { ukladka: 4, vibrace: 3, finis: 2, cerpadlo_koordinace: 3 },
      pump_lines: 2,
      effective_rate_m3h_min: 30,
      effective_rate_m3h_max: 40,
    },
    source: SOURCE_ALEXANDER,
  } as LaborNormRecord<PourCrewModel>,
} as const;
