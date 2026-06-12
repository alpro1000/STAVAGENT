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

/** Mega-pour crew model: ONE finishing front fed by a pump tandem. */
export interface PourCrewModel {
  /** Persons on site on the single finishing front. Pump operators arrive
   *  WITH the pumps (external service) and are NOT part of the crew Nh. */
  crew_on_site: number;
  /** Caltrans Deck Construction Manual Table 1.1 composition (11) +
   *  1 záloha/parťák per Alexander. Sums to crew_on_site. */
  breakdown: {
    predak: number;
    rozhrnovani: number;
    operator_listy: number;
    finiseri: number;
    brum_osetrovani: number;
    vibrace: number;
    tesar_dozor_skruze: number;
    prijem_domichavacu: number;
    zaloha: number;
  };
  /** Pumps feeding the ONE front (tandem: trámy + deska; PDK záložní manned).
   *  Pumps do NOT multiply the crew — also the projection gating threshold. */
  pump_lines: number;
  /** Pour rate of the front (m³/h) — FINISHING-governed, not pump capacity.
   *  Projection uses the midpoint. */
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

  /** Betonáž mega-pour crew model: 12 os. on site on ONE finishing front
   *  (Caltrans Table 1.1: foreman 1 + rake 2 + machine operator 1 + finishers
   *  2 + broom/cure 1 + vibrators 2 + bridge carpenter watching falsework 1 +
   *  truck tender 1 = 11, + 1 záloha per Alexander); 2 čerpadla feed the
   *  front (trámy + deska) — pumps do NOT multiply the crew, strojníci
   *  čerpadel are external; rate 40–45 m³/h FINISHING-governed → hours =
   *  V / rate_mid; Nh = crew × hours × K_UTIL. Crew relief (rotation) at
   *  pour > 12 h stays armed — a second 12-person shift takes over,
   *  headcount on site constant, so Nh does not double. Applied when the
   *  engine pour needs ≥ pump_lines pumps. */
  betonaz_crew_model: {
    value: {
      crew_on_site: 12,
      breakdown: {
        predak: 1,
        rozhrnovani: 2,
        operator_listy: 1,
        finiseri: 2,
        brum_osetrovani: 1,
        vibrace: 2,
        tesar_dozor_skruze: 1,
        prijem_domichavacu: 1,
        zaloha: 1,
      },
      pump_lines: 2,
      effective_rate_m3h_min: 40,
      effective_rate_m3h_max: 45,
    },
    source: 'Caltrans Bridge Deck Construction Manual (Oct 2015) Table 1.1; ' +
      'bridge deck method statement 40–45 m³/h finishing-governed; ' +
      'potvrzeno Alexander, 2026-06',
  } as LaborNormRecord<PourCrewModel>,
} as const;
