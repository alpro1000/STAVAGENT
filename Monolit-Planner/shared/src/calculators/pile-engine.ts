/**
 * Pile Engine — bored pile (vrtaná pilota) productivity, schedule and cost
 *
 * Piles are fundamentally different from every other monolithic element:
 *   - No formwork — soil IS the form
 *   - No lateral pressure — there's nothing to push against
 *   - No tacts — 1 pilota = 1 záběr always
 *   - No supports — pile is in the ground
 *   - Concrete is placed via tremie pipe (under water) or direct discharge
 *     into a dry bore — never with a pump, no vibration (S4/SCC)
 *   - Reinforcement is a pre-fabricated cage (armokoš) lifted by crane,
 *     not in-situ rebar
 *   - Schedule bottleneck is the drilling rig, not crews
 *
 * This module provides:
 *   - PILE_PRODUCTIVITY_TABLE: piles per shift by diameter × geology × method
 *   - calculatePileDrilling(): main entry that builds drilling/concreting
 *     phases, optional pile cap (hlavice), labor/material costs and a
 *     simple traceability log
 *
 * The orchestrator (planner-orchestrator.ts) routes through this module
 * via an early branch when element_type === 'pilota'. The result is then
 * mapped into a standard PlannerOutput so consumers (PlanResult cards,
 * applyPlanToPositions, scheduler-shaped fields) keep working without
 * a parallel type system.
 *
 * Productivity ranges are taken from the task spec (TZ + ČSN 73 1002):
 *
 *   Ø600  CFA (soudržná)        5–8  pilot/směna
 *   Ø600  s pažnicí (soudržná)  3–5  pilot/směna
 *   Ø600  s pažnicí (pod HPV)   2–4  pilot/směna
 *   Ø600  skalní podloží        1–3  pilot/směna
 *   ... (full table below)
 *
 * For diameters between catalog rows we linearly interpolate the mid value
 * by the diameter ratio so an arbitrary Ø500 / Ø750 input does not crash.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

/** Geological condition that drives drilling speed. */
export type PileGeology = 'cohesive' | 'noncohesive' | 'below_gwt' | 'rock';

/** Drilling / casing method. */
export type PileCasingMethod = 'cfa' | 'cased' | 'uncased';

/** Optional pile cap (hlavice) — small concrete patka above the pile. */
export interface PileCapInput {
  /** Length × width × height in metres. Volume derived if not given. */
  length_m: number;
  width_m: number;
  height_m: number;
}

/** All pile-specific input fields. Most are optional and have defaults. */
export interface PileInput {
  /** Pile diameter in millimetres. Default 600. */
  diameter_mm?: number;
  /** Pile length in metres. Default 10. */
  length_m?: number;
  /** Number of piles. If omitted, derived from total volume_m3 ÷ volume per pile. */
  count?: number;
  /** Total concrete volume across all piles. Required (drives back-calculation when count is missing). */
  volume_m3: number;
  /** Geology — drives productivity table column. Default 'cohesive'. */
  geology?: PileGeology;
  /** Casing method. Default 'cfa' (continuous flight auger). */
  casing_method?: PileCasingMethod;
  /** Reinforcement index in kg per m³ of concrete. Default 40. */
  rebar_index_kg_m3?: number;
  /** Optional pile cap (hlavice). When present, cap days are added to the schedule. */
  pile_cap?: PileCapInput;
  /** Crew sizing & wages — fall back to PlannerInput defaults if omitted. */
  crew_size?: number;
  shift_h?: number;
  wage_czk_h?: number;
  /** Drilling rig day rate in Kč per shift. Default 25 000. */
  rig_czk_per_shift?: number;
  /** Crane day rate in Kč per shift (rebar cage placement + casing handling). Default 8 000. */
  crane_czk_per_shift?: number;
}

/** Output of the pile-specific calculation. Lives under PlannerOutput.pile. */
export interface PileResult {
  /** Echo of normalised inputs (with defaults applied). */
  diameter_mm: number;
  length_m: number;
  count: number;
  geology: PileGeology;
  casing_method: PileCasingMethod;
  rebar_index_kg_m3: number;

  /** Volume of one pile in m³ (π × r² × L). */
  volume_per_pile_m3: number;
  /** Total concrete volume across all piles in m³. */
  total_volume_m3: number;

  /** Productivity in piles per shift (mid-range from PILE_PRODUCTIVITY_TABLE). */
  productivity_pile_per_shift: number;

  /** Schedule phases in working days. */
  drilling_days: number;
  /** Technological pause between drilling completion and head adjustment (typically 7d). */
  technological_pause_days: number;
  /** Head-adjustment days (odbourání nekvalitního betonu, ~3 hlavy/směna). */
  head_adjustment_days: number;
  /** Optional pile cap days (bednění + výztuž + betonáž + zrání + odbednění). */
  pile_cap_days?: number;
  /** Total schedule days across all phases. */
  total_days: number;

  /** Total reinforcement mass (armokoše) in kilograms. */
  rebar_total_kg: number;

  /** Cost breakdown in CZK (labor only — material is external like the rest of the planner). */
  costs: {
    drilling_rig_czk: number;
    crane_czk: number;
    crew_labor_czk: number;
    head_adjustment_labor_czk: number;
    pile_cap_labor_czk: number;
    total_labor_czk: number;
  };

  /** Czech-language traceability log (one line per phase). */
  log: string[];
}

// ─── Productivity table ────────────────────────────────────────────────────

/**
 * Mid-range piles per shift (8h) by diameter × geology × casing method.
 *
 * Table maps `${diameter_mm}::${geology}` to a record of method → piles/shift.
 * Values are the midpoint of the spec range — e.g. Ø600 CFA cohesive
 * 5–8 → 6.5. For rock the ranges given are cumulative across methods,
 * so we use the same value regardless of method (rock dominates).
 */
const PILE_PRODUCTIVITY_TABLE: Record<number, Record<PileGeology, Record<PileCasingMethod, number>>> = {
  600: {
    cohesive:    { cfa: 6.5, cased: 4.0, uncased: 4.0 },
    noncohesive: { cfa: 5.0, cased: 3.0, uncased: 3.0 },
    below_gwt:   { cfa: 4.0, cased: 3.0, uncased: 3.0 },
    rock:        { cfa: 2.0, cased: 2.0, uncased: 2.0 },
  },
  900: {
    cohesive:    { cfa: 4.0, cased: 2.5, uncased: 2.5 },
    noncohesive: { cfa: 3.0, cased: 2.0, uncased: 2.0 },
    below_gwt:   { cfa: 2.0, cased: 1.5, uncased: 1.5 },
    rock:        { cfa: 1.5, cased: 1.5, uncased: 1.5 },
  },
  1200: {
    cohesive:    { cfa: 2.5, cased: 1.5, uncased: 1.5 },
    noncohesive: { cfa: 2.0, cased: 1.2, uncased: 1.2 },
    below_gwt:   { cfa: 1.0, cased: 1.0, uncased: 1.0 },
    rock:        { cfa: 0.75, cased: 0.75, uncased: 0.75 },
  },
  1500: {
    cohesive:    { cfa: 1.5, cased: 0.75, uncased: 0.75 },
    noncohesive: { cfa: 1.2, cased: 0.6, uncased: 0.6 },
    below_gwt:   { cfa: 0.5, cased: 0.5, uncased: 0.5 },
    rock:        { cfa: 0.4, cased: 0.4, uncased: 0.4 },
  },
};

const TABLE_DIAMETERS = Object.keys(PILE_PRODUCTIVITY_TABLE)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Productivity lookup with linear interpolation by diameter for off-catalog sizes.
 * Diameters below the catalog minimum clamp to the smallest row;
 * diameters above the maximum clamp to the largest row.
 *
 * Productivity falls roughly with the cross-section area (∝ diameter²),
 * so we interpolate in 1/diameter² space which empirically tracks the
 * tabular ranges better than linear-in-diameter.
 */
export function getPileProductivity(
  diameter_mm: number,
  geology: PileGeology,
  casing_method: PileCasingMethod,
): number {
  // Clamp to catalog bounds
  if (diameter_mm <= TABLE_DIAMETERS[0]) {
    return PILE_PRODUCTIVITY_TABLE[TABLE_DIAMETERS[0]][geology][casing_method];
  }
  if (diameter_mm >= TABLE_DIAMETERS[TABLE_DIAMETERS.length - 1]) {
    return PILE_PRODUCTIVITY_TABLE[TABLE_DIAMETERS[TABLE_DIAMETERS.length - 1]][geology][casing_method];
  }

  // Find bracket
  let lo = TABLE_DIAMETERS[0];
  let hi = TABLE_DIAMETERS[TABLE_DIAMETERS.length - 1];
  for (let i = 0; i < TABLE_DIAMETERS.length - 1; i++) {
    if (diameter_mm >= TABLE_DIAMETERS[i] && diameter_mm <= TABLE_DIAMETERS[i + 1]) {
      lo = TABLE_DIAMETERS[i];
      hi = TABLE_DIAMETERS[i + 1];
      break;
    }
  }

  const pLo = PILE_PRODUCTIVITY_TABLE[lo][geology][casing_method];
  const pHi = PILE_PRODUCTIVITY_TABLE[hi][geology][casing_method];

  // Interpolate productivity ∝ 1/d²
  const invSqLo = 1 / (lo * lo);
  const invSqHi = 1 / (hi * hi);
  const invSq = 1 / (diameter_mm * diameter_mm);
  const t = (invSq - invSqHi) / (invSqLo - invSqHi); // 0 at hi, 1 at lo
  const result = pHi + t * (pLo - pHi);

  return Math.round(result * 100) / 100;
}

// ─── Volume helpers ────────────────────────────────────────────────────────

/** Volume of one cylindrical pile in m³: π × (Ø/2)² × L. */
export function calculatePileVolume(diameter_mm: number, length_m: number): number {
  const r_m = diameter_mm / 2 / 1000;
  return Math.PI * r_m * r_m * length_m;
}

/**
 * Derive pile count from total volume when the user only gave volume_m3.
 * Returns at least 1.
 */
export function derivePileCount(
  total_volume_m3: number,
  diameter_mm: number,
  length_m: number,
): number {
  const v1 = calculatePileVolume(diameter_mm, length_m);
  if (v1 <= 0) return 1;
  return Math.max(1, Math.round(total_volume_m3 / v1));
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULTS = {
  diameter_mm: 600,
  length_m: 10,
  geology: 'cohesive' as PileGeology,
  casing_method: 'cfa' as PileCasingMethod,
  rebar_index_kg_m3: 40,
  crew_size: 6, // 2 obsluha rigu + 2 železáři + 2 betonáři/pomocní
  shift_h: 8, // pile shifts are typically 8h, not 10h
  wage_czk_h: 398,
  rig_czk_per_shift: 25_000,
  crane_czk_per_shift: 8_000,
  /** Technological pause between drilling and head adjustment (ČSN 73 1002 + praxe) */
  technological_pause_days: 7,
  /** Heads adjusted per shift (odbourání + úprava výztuže). Empirical. */
  heads_per_shift: 3,
};

// ─── Main entry ────────────────────────────────────────────────────────────

/**
 * calculatePileDrilling — main entry point used by the orchestrator's pile branch.
 *
 * Steps:
 *   1. Resolve defaults for missing pile-specific inputs
 *   2. Compute volume_per_pile (or back-derive count from total volume)
 *   3. Look up productivity from the table
 *   4. Build schedule phases: drilling → 7d pause → head adjustment → optional cap
 *   5. Build cost breakdown (rig × shifts + crane × shifts + crew × shifts × wage + cap labor)
 *   6. Emit a Czech traceability log
 *
 * Material costs (concrete, steel) are NOT included — same convention as the
 * rest of the planner, where material is treated as external and only labor
 * + equipment rental flow through the engines.
 */
export function calculatePileDrilling(input: PileInput): PileResult {
  const diameter_mm = input.diameter_mm ?? DEFAULTS.diameter_mm;
  const length_m = input.length_m ?? DEFAULTS.length_m;
  const geology = input.geology ?? DEFAULTS.geology;
  const casing_method = input.casing_method ?? DEFAULTS.casing_method;
  const rebar_index_kg_m3 = input.rebar_index_kg_m3 ?? DEFAULTS.rebar_index_kg_m3;
  const crew_size = input.crew_size ?? DEFAULTS.crew_size;
  const shift_h = input.shift_h ?? DEFAULTS.shift_h;
  const wage_czk_h = input.wage_czk_h ?? DEFAULTS.wage_czk_h;
  const rig_czk_per_shift = input.rig_czk_per_shift ?? DEFAULTS.rig_czk_per_shift;
  const crane_czk_per_shift = input.crane_czk_per_shift ?? DEFAULTS.crane_czk_per_shift;

  // ── 1. Volume + count ──────────────────────────────────────────────────
  const volume_per_pile_m3 = calculatePileVolume(diameter_mm, length_m);
  // Use explicit count if given; otherwise derive from total volume.
  const count = input.count && input.count > 0
    ? Math.max(1, Math.round(input.count))
    : derivePileCount(input.volume_m3, diameter_mm, length_m);
  // Total volume: prefer user-supplied total (it may include rounding for
  // overflow/loss); fall back to count × volume_per_pile.
  const total_volume_m3 = input.volume_m3 > 0
    ? input.volume_m3
    : count * volume_per_pile_m3;

  // ── 2. Productivity & drilling days ────────────────────────────────────
  const productivity = getPileProductivity(diameter_mm, geology, casing_method);
  // ceil — partial shift = full shift on a real site
  const drilling_days = Math.max(1, Math.ceil(count / productivity));

  // ── 3. Head adjustment ─────────────────────────────────────────────────
  const head_adjustment_days = Math.max(1, Math.ceil(count / DEFAULTS.heads_per_shift));

  // ── 4. Optional pile cap (hlavice) ─────────────────────────────────────
  // We treat the cap as a small patka with simplified labor formulas:
  //   - bednění:  4 m²/h · person → cap_area / (4 × crew × shift)
  //   - výztuž:   80 kg/h · person × 0.5 (small element overhead) → ~40 kg/h
  //   - betonáž:  6 m³/h
  //   - zrání:    7 days
  //   - odbednění: half of bednění
  // Total cap labor cost is computed inline; the Card in the UI just shows
  // the day total. This avoids a recursive planElement call (out of scope).
  let pile_cap_days: number | undefined;
  let pile_cap_labor_czk = 0;
  if (input.pile_cap) {
    const { length_m: cl, width_m: cw, height_m: ch } = input.pile_cap;
    const cap_volume_m3 = cl * cw * ch;
    const cap_area_m2 = 2 * (cl + cw) * ch + cl * cw; // sides + top
    const cap_rebar_kg = cap_volume_m3 * 80; // patka rebar index ≈ 80 kg/m³
    const formwork_h = cap_area_m2 / (4 * crew_size);
    const rebar_h = cap_rebar_kg / (40 * crew_size);
    const concrete_h = cap_volume_m3 / (6 * crew_size);
    const stripping_h = formwork_h * 0.5;
    const cap_total_h = formwork_h + rebar_h + concrete_h + stripping_h;
    const cap_active_days = Math.max(1, Math.ceil(cap_total_h / shift_h));
    const cap_curing_days = 7;
    pile_cap_days = cap_active_days + cap_curing_days;
    pile_cap_labor_czk = Math.round(cap_total_h * crew_size * wage_czk_h);
  }

  // ── 5. Schedule total ──────────────────────────────────────────────────
  const total_days =
    drilling_days +
    DEFAULTS.technological_pause_days +
    head_adjustment_days +
    (pile_cap_days ?? 0);

  // ── 6. Costs ───────────────────────────────────────────────────────────
  // Drilling phase: rig + crane + crew
  const drilling_rig_czk = drilling_days * rig_czk_per_shift;
  const crane_czk = drilling_days * crane_czk_per_shift;
  const crew_labor_czk = Math.round(drilling_days * crew_size * shift_h * wage_czk_h);
  // Head adjustment: 2-person crew, no rig
  const head_crew = 2;
  const head_adjustment_labor_czk = Math.round(
    head_adjustment_days * head_crew * shift_h * wage_czk_h
  );
  const total_labor_czk =
    drilling_rig_czk +
    crane_czk +
    crew_labor_czk +
    head_adjustment_labor_czk +
    pile_cap_labor_czk;

  // ── 7. Rebar mass (armokoše) ───────────────────────────────────────────
  const rebar_total_kg = Math.round(total_volume_m3 * rebar_index_kg_m3);

  // ── 8. Traceability log ────────────────────────────────────────────────
  const geologyLabelCs: Record<PileGeology, string> = {
    cohesive: 'soudržná zemina',
    noncohesive: 'nesoudržná zemina',
    below_gwt: 'pod hladinou podzemní vody',
    rock: 'skalní podloží',
  };
  const methodLabelCs: Record<PileCasingMethod, string> = {
    cfa: 'CFA (průběžný šnek)',
    cased: 's pažnicí',
    uncased: 'bez pažení',
  };
  const log: string[] = [
    `Pilota: Ø${diameter_mm} × ${length_m} m, počet ${count}`,
    `Geologie: ${geologyLabelCs[geology]}, metoda: ${methodLabelCs[casing_method]}`,
    `Objem 1 piloty: ${volume_per_pile_m3.toFixed(2)} m³, celkem ${total_volume_m3.toFixed(1)} m³`,
    `Produktivita: ${productivity} pilot/směna → vrtání ${drilling_days} dní`,
    `Technologická přestávka: ${DEFAULTS.technological_pause_days} dní (ČSN 73 1002)`,
    `Úprava hlav: ${head_adjustment_days} dní (${DEFAULTS.heads_per_shift} hlav/směna)`,
    ...(pile_cap_days ? [`Hlavice: ${pile_cap_days} dní (vč. zrání)`] : []),
    `Armokoše: ${rebar_total_kg} kg (index ${rebar_index_kg_m3} kg/m³)`,
    `Celkem schedule: ${total_days} dní`,
  ];

  return {
    diameter_mm,
    length_m,
    count,
    geology,
    casing_method,
    rebar_index_kg_m3,
    volume_per_pile_m3: Math.round(volume_per_pile_m3 * 100) / 100,
    total_volume_m3: Math.round(total_volume_m3 * 10) / 10,
    productivity_pile_per_shift: productivity,
    drilling_days,
    technological_pause_days: DEFAULTS.technological_pause_days,
    head_adjustment_days,
    pile_cap_days,
    total_days,
    rebar_total_kg,
    costs: {
      drilling_rig_czk,
      crane_czk,
      crew_labor_czk,
      head_adjustment_labor_czk,
      pile_cap_labor_czk,
      total_labor_czk,
    },
    log,
  };
}
