/**
 * Zeleznice-Planner shared types — railway svršek + spodek engine.
 *
 * Domain contract (TASK Železniční svršek+spodek + docs/specs/zeleznicni-svrsek-spodek/):
 * - two layers that NEVER mix: 'spodek' (zemní těleso) vs 'svrsek' (kolejový
 *   rošt + kolejové lože); every výkaz item carries its layer.
 * - decomposition is driven by DÉLKA KOLEJE × SESTAVA svršku (not concrete m³).
 * - every number carries formula + source + confidence (replay guarantee);
 *   a missing input yields an honest NEPOČÍTÁNO, never a fabricated value.
 * - km trati ≠ km koleje: vícekolejný úsek se počítá NA KOLEJ.
 */

// ── Provenance & quantities ─────────────────────────────────────────────────

export interface RailQuantitySource {
  document: string;
  section?: string;
  note?: string;
}

/**
 * A computed railway quantity with full provenance. `status: 'nepocitano'`
 * is the honest-blank: value stays null and `reason_cs` explains why
 * (missing profile, missing norm, not-applicable) — never a paušál or zero.
 */
export interface RailQuantity {
  value: number | null;
  unit: string;
  /** Vzorec s dosazením — replay guarantee (stejné vstupy → stejný výstup). */
  formula: string;
  source: RailQuantitySource;
  confidence: number;
  status: 'ok' | 'nepocitano';
  reason_cs?: string;
}

// ── Input ───────────────────────────────────────────────────────────────────

export type RailTrackForm = 'stykovana' | 'bezstykova';
export type RailContractType = 'sz_verejna' | 'vlecka';
export type RailProjectKind = 'novostavba' | 'rekonstrukce' | 'udrzba';
export type RailLayer = 'spodek' | 'svrsek';

export type BallastProfileInput =
  /** Plocha celého průřezu lože z vzorového příčného řezu (m²). */
  | { mode: 'area'; area_m2: number }
  /** Parametrický lichoběžník: A = koruna×t + sklon×t² (na JEDNU kolej). */
  | {
      mode: 'parametric';
      thickness_under_sleeper_m: number;
      crown_width_m: number;
      slope_ratio: number;
    }
  /** KB preset (vzorový list — orientační, vyžaduje potvrzení). */
  | { mode: 'preset'; preset_id: string };

export interface TurnoutInput {
  form_id: string;
  count: number;
}

/** Překážky demontované před nasazením strojní linky a zpět (TASK §3.9). */
export interface ObstaclesInput {
  prejezdy?: number;
  prechody?: number;
  ukolejneni?: number;
  pojistne_uhelniky_m?: number;
  magneticke_body?: number;
}

/** Položka železničního spodku — vstupní výměra (v1 pass-through + sekvence). */
export interface SpodekItemInput {
  name_cs: string;
  unit: string;
  quantity: number;
  /** zemni_prace | plan_spodku | konstrukcni_vrstvy | odvodneni | ostatni */
  work_type?: string;
}

/** Volba stroje pro daný typ práce (jinak auto podle registru + omezení). */
export interface MachineChoiceInput {
  work_type: string;
  machine_id: string;
  mode_id?: string;
}

/** Uživatelská výkonová norma firmy — priorita 0.99 (TASK §3.7). */
export interface UserMachineNorm {
  machine_id: string;
  mode_id?: string;
  rate_value: number;
  rate_unit: 'm/h' | 'h/ks';
}

export interface RailPlannerInput {
  /** Staničení km od–do (alternativa k section_length_m). */
  km_od?: number;
  km_do?: number;
  section_length_m?: number;
  /** Počet kolejí — všechno svrškové se počítá NA KOLEJ. */
  track_count: number;

  assembly_id: string;
  /** Rozdělení pražců (b/c/d/e/u) — jinak default sestavy. */
  spacing_code?: string;
  /** Délka kolejnicového pole (20/25 m, kde sestava dovoluje). */
  field_length_m?: number;
  /** Rozteč upevňovacích bodů pro pražce Y (jinak KB default + warning). */
  y_sleeper_spacing_m?: number;

  contract_type?: RailContractType;
  project_kind?: RailProjectKind;

  ballast_profile?: BallastProfileInput;
  /** Nejmenší poloměr oblouku v úseku (m) — kontrola omezení strojů. */
  curve_min_radius_m?: number;
  /** Max převýšení v oblouku (mm) — v1 jen ℹ️ dopad na objem lože. */
  cant_max_mm?: number;

  turnouts?: TurnoutInput[];
  izolovane_styky_ks?: number;
  /** Dodávaná délka kolejnicových pásů pro BK (jinak KB default). */
  rail_delivery_length_m?: number;

  obstacles?: ObstaclesInput;
  spodek_items?: SpodekItemInput[];

  machines?: MachineChoiceInput[];
  user_machine_norms?: UserMachineNorm[];

  /** Délka směny (h) — default 8. */
  shift_hours?: number;
  /** Výlukové okno za den (h) — jinak čistý výkon ve směně. */
  possession_window_h?: number;
  /** Délka pracovní fronty (m) — default délka úseku (Pattern 50). */
  front_length_m?: number;
}

// ── Output ──────────────────────────────────────────────────────────────────

export type RailCodeStatus = 'exact' | 'candidate' | 'group_only' | 'not_verified';
export type RailPricingSystem = 'OTSKP_ZS' | 'UOZI' | 'URS_824_1';

export interface RailCatalogBinding {
  pricing_system: RailPricingSystem;
  code: string | null;
  code_status: RailCodeStatus;
  note_cs: string;
}

export interface RailVykazItem {
  id: string;
  layer: RailLayer;
  name_cs: string;
  unit: string;
  quantity: RailQuantity;
  phase_id?: string;
  catalog?: RailCatalogBinding;
}

export interface RailMachineAssignment {
  machine_id: string;
  machine_name_cs: string;
  mode_id: string;
  mode_name_cs: string;
  rate_value: number | null;
  rate_unit: 'm/h' | 'h/ks';
  /** Odkud norma pochází — uživatelská norma firmy / katalog / honest-blank. */
  rate_source: string;
  rate_confidence: number;
  crew_size: number | null;
}

export interface RailPhase {
  id: string;
  name_cs: string;
  layer: RailLayer;
  depends_on: string[];
  work_type?: string;
  quantity?: RailQuantity;
  machine?: RailMachineAssignment | null;
  duration_days: RailQuantity;
}

export interface RailMachineDeploymentRow {
  phase_id: string;
  phase_name_cs: string;
  machine: RailMachineAssignment | null;
  hours: RailQuantity;
  days: RailQuantity;
}

export interface RailTrackGang {
  size: number;
  base_size: number;
  front_length_m: number;
  front_capacity_limit: number;
  workspace_m_per_worker: number;
  source: string;
  confidence: number;
}

export interface RailSafetyRole {
  id: string;
  name_cs: string;
  count: number;
  mandatory: boolean;
}

export interface RailCrewPlan {
  machine_crews: Array<{
    machine_id: string;
    machine_name_cs: string;
    crew_size: number | null;
    source: string;
  }>;
  track_gang: RailTrackGang;
  safety_roles: RailSafetyRole[];
}

export interface RailTurnoutResult {
  form_id: string;
  name_cs: string;
  complexity: string;
  count: number;
  podbiti_hours: RailQuantity;
  montaz_hours: RailQuantity;
  bk_svary_ks: RailQuantity;
}

export interface RailStructuredWarning {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface RailSectionSummary {
  km_od: number | null;
  km_do: number | null;
  delka_trati_m: number;
  delka_koleje_m: number;
  track_count: number;
}

export interface RailAssemblyEcho {
  assembly_id: string;
  name_cs: string;
  rail_profile: string;
  sleeper_type: string;
  fastening: string;
  track_form: RailTrackForm;
  spacing_code: string | null;
  field_length_m: number;
}

export interface RailQuantitiesBlock {
  prazce_ks: RailQuantity;
  prazce_hmotnost_t: RailQuantity;
  kolejnice_delka_m: RailQuantity;
  kolejnice_hmotnost_t: RailQuantity;
  upevneni_komplety_ks: RailQuantity;
  kolejova_pole_ks: RailQuantity;
  styky_ks: RailQuantity;
  svary_mezipasove_ks: RailQuantity;
  zaverne_svary_ks: RailQuantity;
  loze_prurez_m2: RailQuantity;
  loze_objem_m3: RailQuantity;
}

export interface RailPlanResult {
  meta: {
    engine_version: string;
    /** Replay guarantee: stejné vstupy → stejný výstup, každé číslo s vzorcem. */
    replay_note: string;
  };
  section: RailSectionSummary;
  assembly: RailAssemblyEcho;
  quantities: RailQuantitiesBlock;
  vykaz: RailVykazItem[];
  turnouts: RailTurnoutResult[];
  bk_chain: RailPhase[];
  sequence: RailPhase[];
  machine_deployment: RailMachineDeploymentRow[];
  crews: RailCrewPlan;
  warnings: string[];
  warnings_structured: RailStructuredWarning[];
}

// ── Typed failures (duck-typed markers, safe across bundles) ────────────────

/** Honest NEPOČÍTÁNO na úrovni celého plánu (chybí délka úseku apod.). */
export class RailUncalculatedError extends Error {
  uncalculated = true as const;
  reason_cs: string;
  missing_fields: string[];
  constructor(reason_cs: string, missing_fields: string[] = []) {
    super(reason_cs);
    this.name = 'RailUncalculatedError';
    this.reason_cs = reason_cs;
    this.missing_fields = missing_fields;
  }
}

/** Neplatný vstup (neznámá sestava/rozdělení/tvar výhybky) — 400, ne 422. */
export class RailInputError extends Error {
  invalid_input = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'RailInputError';
  }
}
