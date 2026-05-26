/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: kb/lateral_pressure.yaml
 * Regenerate: npm run gen:knowledge
 */

/** DIN 18218 / ČSN EN 12812 lateral pressure constants. */
export const LATERAL_PRESSURE_CONSTANTS = {"rho_kg_m3":2400,"g_m_s2":9.81,"min_stage_height_m":1.5,"default_cure_between_stages_h":12} as const;

/** k-factor by concrete consistency (DIN 18218). */
export const K_FACTORS_BY_CONSISTENCY: Record<'standard' | 'plastic' | 'scc', number> = {"standard":0.85,"plastic":1,"scc":1.5};

/** Pour rate (m/h) → k coefficient bands (ČSN EN 12812). */
export interface PourRateBand {
  max_rate_m_h: number;
  k: number;
  description: string;
}
export const POUR_RATE_TO_K: PourRateBand[] = [{"max_rate_m_h":1,"k":1,"description":"≤ 1 m/h (gravity, crane bucket, hand pour)"},{"max_rate_m_h":2,"k":1.2,"description":"1–2 m/h (slow pump, controlled pour)"},{"max_rate_m_h":999,"k":1.5,"description":"> 2 m/h (fast pump, SCC, high-flow placement)"}];

/** Reinforced concrete density (kg/m³). */
export const RHO_KG_M3 = 2400;
/** Gravitational acceleration (m/s²). */
export const G_M_S2 = 9.81;

/** Return k-factor for a consistency name. */
export function getKFactorForConsistency(consistency: 'standard' | 'plastic' | 'scc'): number {
  return K_FACTORS_BY_CONSISTENCY[consistency] ?? K_FACTORS_BY_CONSISTENCY.standard;
}

/** Return k from pour rate band (first matching band). */
export function getKFromPourRate(pourRateMH: number): number {
  for (const band of POUR_RATE_TO_K) {
    if (pourRateMH <= band.max_rate_m_h) return band.k;
  }
  return POUR_RATE_TO_K[POUR_RATE_TO_K.length - 1].k;
}

export const SOURCE_CITATION = {"primary_norm":"ČSN EN 12812 (Falsework — performance requirements + general design)","secondary_reference":"DIN 18218 (Frischbetondruck auf lotrechte Schalungen) — not full-text, only k ranges via DOKA/PERI brochures","literature_fallback":["Pokorný, Suchánek: Betonové mosty II — lateral-pressure chapter","DOKA Frischbetondruck Technical Information","PERI Frischbetondruck katalog ranges"],"extracted_from":["Monolit-Planner/shared/src/calculators/lateral-pressure.ts (getConsistencyKFactor)"],"decision_notes":"Týden 3 (2026-05-26): chose ČSN EN 12812 + literatura instead of buying\nDIN 18218 (~€100). DOKA/PERI brochure ranges + EN 12812 cover all real\nuse cases in CZ market. Future update if DIN acquired officially.\n","extraction_date":"2026-05-26"} as const;
