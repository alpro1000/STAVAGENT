/**
 * Props Calculator v1.0
 *
 * Calculates shoring/propping requirements for horizontal concrete elements:
 * - Number of props (from area + grid spacing)
 * - Prop type selection (from height)
 * - Assembly / disassembly time
 * - Rental cost
 * - Hold duration (from maturity / ČSN EN 13670)
 *
 * Applies to elements with needs_supports = true:
 *   mostovka, stropní deska, průvlak, římsová deska, schodiště, rigel
 *
 * Standards: ČSN EN 13670, ČSN 73 6244, DOKA Eurex/Staxo catalogs
 */

import type { StructuralElementType } from './pour-decision.js';

// ─── Prop System Catalog ────────────────────────────────────────────────────

export interface PropSystem {
  name: string;
  manufacturer: string;
  /** Maximum working height (m) */
  max_height_m: number;
  /** Minimum working height (m) */
  min_height_m: number;
  /** Assembly time per prop (hours) */
  assembly_h_per_prop: number;
  /** Disassembly time per prop (hours) */
  disassembly_h_per_prop: number;
  /** Rental rate CZK / prop / day */
  rental_czk_per_prop_day: number;
  /** Weight per prop (kg) — for crane planning */
  weight_kg: number;
}

export const PROP_SYSTEMS: PropSystem[] = [
  {
    name: 'Eurex 20 top',
    manufacturer: 'Doka',
    min_height_m: 1.5,
    max_height_m: 3.5,
    assembly_h_per_prop: 0.12,
    disassembly_h_per_prop: 0.08,
    rental_czk_per_prop_day: 12,
    weight_kg: 18,
  },
  {
    name: 'Eurex 30 top',
    manufacturer: 'Doka',
    min_height_m: 2.5,
    max_height_m: 5.5,
    assembly_h_per_prop: 0.18,
    disassembly_h_per_prop: 0.12,
    rental_czk_per_prop_day: 18,
    weight_kg: 28,
  },
  {
    name: 'Staxo 40',
    manufacturer: 'Doka',
    min_height_m: 4.0,
    max_height_m: 12.0,
    assembly_h_per_prop: 0.35,
    disassembly_h_per_prop: 0.25,
    rental_czk_per_prop_day: 45,
    weight_kg: 85,
  },
  {
    name: 'Staxo 100',
    manufacturer: 'Doka',
    min_height_m: 8.0,
    max_height_m: 20.0,
    assembly_h_per_prop: 0.55,
    disassembly_h_per_prop: 0.40,
    rental_czk_per_prop_day: 75,
    weight_kg: 160,
  },
  {
    name: 'PEP Ergo',
    manufacturer: 'PERI',
    min_height_m: 1.5,
    max_height_m: 3.5,
    assembly_h_per_prop: 0.10,
    disassembly_h_per_prop: 0.07,
    rental_czk_per_prop_day: 11,
    weight_kg: 16,
  },
  {
    name: 'Multiprop MP 250',
    manufacturer: 'PERI',
    min_height_m: 1.5,
    max_height_m: 5.0,
    assembly_h_per_prop: 0.15,
    disassembly_h_per_prop: 0.10,
    rental_czk_per_prop_day: 15,
    weight_kg: 22,
  },
  {
    name: 'ST 100',
    manufacturer: 'PERI',
    min_height_m: 4.0,
    max_height_m: 14.0,
    assembly_h_per_prop: 0.40,
    disassembly_h_per_prop: 0.28,
    rental_czk_per_prop_day: 50,
    weight_kg: 95,
  },
];

// ─── Grid Spacing Defaults ──────────────────────────────────────────────────

/** Default prop grid spacing by element type (m × m) */
export const PROP_GRID_DEFAULTS: Partial<Record<StructuralElementType, { grid_m: number; description: string }>> = {
  stropni_deska:     { grid_m: 1.5,  description: 'Stropní deska: stojky 1.5 × 1.5 m (Dokaflex raster)' },
  mostovkova_deska:  { grid_m: 1.25, description: 'Mostovka: skruž 1.25 × 1.25 m (Top 50 / Staxo raster)' },
  pruvlak:           { grid_m: 1.0,  description: 'Průvlak: podpěry 1.0 × 1.0 m (pod liniovým prvkem)' },
  rigel:             { grid_m: 1.0,  description: 'Příčník: podpěry 1.0 × 1.0 m (pod liniovým prvkem)' },
  rimsa:             { grid_m: 1.25, description: 'Římsová deska: konzolové podpěry 1.25 × 1.25 m' },
  schodiste:         { grid_m: 1.25, description: 'Schodiště: podpěry 1.25 × 1.25 m (šikmá plocha)' },
};

// ─── Element Dimension Hints ────────────────────────────────────────────────

export interface DimensionHint {
  /** Which dimensions are needed for this element type */
  required_dimensions: ('height_m' | 'length_m' | 'width_m' | 'thickness_m')[];
  /** Czech description of what to enter */
  hint_cs: string;
  /** Typical height range [min, max] in meters */
  typical_height_range?: [number, number];
  /** Whether height_m is relevant */
  has_height: boolean;
}

export const ELEMENT_DIMENSION_HINTS: Record<StructuralElementType, DimensionHint> = {
  // ─── Bridge: horizontal with supports ────
  mostovkova_deska: {
    required_dimensions: ['height_m', 'thickness_m'],
    hint_cs: 'Výška = podpěrné lešení od terénu po spodek desky. Tloušťka = průřez desky.',
    typical_height_range: [4, 20],
    has_height: true,
  },
  rimsa: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška = vzdálenost od mostovky po spodek římsy (konzola).',
    typical_height_range: [1.5, 4],
    has_height: true,
  },
  rigel: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška = od základu pilíře po spodek příčníku.',
    typical_height_range: [3, 15],
    has_height: true,
  },
  // ─── Bridge: vertical (no supports) ────
  zaklady_piliru: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška základu (bednění pouze boční). Podpěry nepotřeba.',
    typical_height_range: [1, 3],
    has_height: true,
  },
  zaklady_oper: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška základu (bednění pouze boční). Podpěry nepotřeba.',
    typical_height_range: [1, 3],
    has_height: true,
  },
  driky_piliru: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška dříku pilíře. Ovlivňuje volbu lešení a plošin.',
    typical_height_range: [3, 25],
    has_height: true,
  },
  operne_zdi: {
    required_dimensions: ['height_m', 'length_m'],
    hint_cs: 'Výška zdi (m), délka zdi (m). Vertikální — bez podpěr.',
    typical_height_range: [2, 10],
    has_height: true,
  },
  opery_ulozne_prahy: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška opěry od základové spáry.',
    typical_height_range: [3, 12],
    has_height: true,
  },
  kridla_opery: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška křídla opěry. Samostatný záběr bednění.',
    typical_height_range: [1.5, 6],
    has_height: true,
  },
  mostni_zavirne_zidky: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška zídky (typicky 0.5–1.5 m). Malý prvek, bez podpěr.',
    typical_height_range: [0.5, 1.5],
    has_height: true,
  },
  prechodova_deska: {
    required_dimensions: ['thickness_m'],
    hint_cs: 'Tloušťka přechodové desky (m). Na terénu za opěrou — bez podpěr.',
    has_height: false,
  },
  // ─── Building: horizontal with supports ────
  stropni_deska: {
    required_dimensions: ['height_m', 'thickness_m'],
    hint_cs: 'Výška = světlá výška podlaží (stojky). Tloušťka desky = průřez.',
    typical_height_range: [2.5, 4.5],
    has_height: true,
  },
  pruvlak: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška = od podlahy po spodek průvlaku (podpěry).',
    typical_height_range: [2.5, 6],
    has_height: true,
  },
  schodiste: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška = podlažní výška schodiště (podpěry pod šikmou deskou).',
    typical_height_range: [2.8, 4.2],
    has_height: true,
  },
  // ─── Building: vertical (no supports) ────
  stena: {
    required_dimensions: ['height_m', 'length_m'],
    hint_cs: 'Výška stěny (m). Vertikální — bez podpěr, ovlivňuje plošiny.',
    typical_height_range: [2.5, 6],
    has_height: true,
  },
  sloup: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška sloupu (m). Vertikální — bez podpěr.',
    typical_height_range: [2.5, 6],
    has_height: true,
  },
  // ─── Foundation: no height needed typically ────
  zakladova_deska: {
    required_dimensions: ['thickness_m'],
    hint_cs: 'Tloušťka desky (m). Na terénu — bez podpěr, bez výšky.',
    has_height: false,
  },
  zakladovy_pas: {
    required_dimensions: [],
    hint_cs: 'Základový pás — bednění pouze boční, bez výšky.',
    has_height: false,
  },
  zakladova_patka: {
    required_dimensions: [],
    hint_cs: 'Základová patka — bednění pouze boční, bez výšky.',
    has_height: false,
  },
  // ─── Special ────
  nadrz: {
    required_dimensions: ['height_m'],
    hint_cs: 'Výška stěny nádrže (m). Vertikální — bez podpěr.',
    typical_height_range: [2, 8],
    has_height: true,
  },
  podzemni_stena: {
    required_dimensions: [],
    hint_cs: 'Podzemní stěna — bednění řízené jílovým suspenzí, bez klasické výšky.',
    has_height: false,
  },
  pilota: {
    required_dimensions: [],
    hint_cs: 'Pilota — vrtaná, bez bednění a podpěr.',
    has_height: false,
  },
  podkladni_beton: {
    required_dimensions: ['thickness_m'],
    hint_cs: 'Podkladní beton — prostý beton na terénu, bez bednění a podpěr.',
    has_height: false,
  },
  podlozkovy_blok: {
    required_dimensions: ['height_m'],
    hint_cs: 'Podložiskový blok — malý ŽB prvek pod ložisko (typicky 0.3–0.5 m).',
    typical_height_range: [0.2, 0.6],
    has_height: true,
  },
  other: {
    required_dimensions: ['height_m'],
    hint_cs: 'Zadejte výšku elementu (m) pro odhad podpěr.',
    typical_height_range: [2, 10],
    has_height: true,
  },
};

// ─── Input / Output ─────────────────────────────────────────────────────────

export interface PropsCalculatorInput {
  /** Element type — determines grid spacing default and whether props needed */
  element_type: StructuralElementType;
  /** Height from ground/floor to underside of element (m) */
  height_m: number;
  /** Formwork area (m²) — same as formwork area per tact */
  formwork_area_m2: number;
  /** Grid spacing override (m). Default from PROP_GRID_DEFAULTS */
  grid_spacing_m?: number;
  /** Prop hold duration (days) — from maturity / skruz calculation */
  hold_days: number;
  /** Assembly + disassembly buffer days (transport, cleaning) */
  buffer_days?: number;
  /** Workers available for prop assembly */
  crew_size?: number;
  /** Shift hours */
  shift_h?: number;
  /** Time utilization factor */
  k?: number;
  /** Wage CZK/h */
  wage_czk_h?: number;
  /** Number of tacts — for rental calculation (how many tact-durations props are needed) */
  num_tacts: number;
  /** Prop system name override (auto-select if not given) */
  prop_system_name?: string;
  /** Formwork manufacturer hint (DOKA/PERI/ULMA/NOE) — props will prefer matching vendor */
  formwork_manufacturer?: string;
}

export interface PropsCalculatorResult {
  /** Whether props are needed at all */
  needed: boolean;
  /** Selected prop system */
  system: PropSystem;
  /** Grid spacing used (m) */
  grid_spacing_m: number;
  /** Number of props per tact */
  num_props_per_tact: number;
  /** Total props needed (considering rotations between tacts) */
  total_props_needed: number;
  /** Assembly time per tact (hours) */
  assembly_hours: number;
  /** Disassembly time per tact (hours) */
  disassembly_hours: number;
  /** Assembly days per tact */
  assembly_days: number;
  /** Disassembly days per tact */
  disassembly_days: number;
  /** Total labor hours across all tacts (assembly + disassembly) — exposed for TOV/KPI */
  labor_hours: number;
  /** Hold duration (days) — props stay under element */
  hold_days: number;
  /** Rental duration per set (days) */
  rental_days: number;
  /** Rental cost (CZK) — total for all props */
  rental_cost_czk: number;
  /** Labor cost for assembly + disassembly (CZK) — all tacts */
  labor_cost_czk: number;
  /** Total cost (rental + labor) */
  total_cost_czk: number;
  /** Total weight of props (kg) — for crane planning */
  total_weight_kg: number;
  /** Whether crane is needed for prop installation */
  crane_needed: boolean;
  /** Warnings */
  warnings: string[];
  /** Decision log entries */
  log: string[];
}

// ─── Calculator ─────────────────────────────────────────────────────────────

function roundTo(val: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

/**
 * Select the best prop system for given height.
 * If preferred_manufacturer is set (e.g. "DOKA" from the chosen formwork system),
 * prefer props from that same vendor. Falls back to cheapest overall if no match.
 */
export function selectPropSystem(
  height_m: number,
  override_name?: string,
  preferred_manufacturer?: string,
): PropSystem {
  if (override_name) {
    const found = PROP_SYSTEMS.find(s => s.name === override_name);
    if (found) return found;
  }

  // Filter systems that cover this height
  const candidates = PROP_SYSTEMS.filter(s => height_m >= s.min_height_m && height_m <= s.max_height_m);

  if (candidates.length === 0) {
    // Height out of range — pick closest
    if (height_m < 1.5) {
      return PROP_SYSTEMS[0]; // Eurex 20 (shortest)
    }
    return PROP_SYSTEMS[PROP_SYSTEMS.length - 2]; // Staxo 100 (tallest)
  }

  // If vendor hint is given, prefer matching manufacturer first
  if (preferred_manufacturer) {
    const matching = candidates.filter(s =>
      s.manufacturer.toLowerCase() === preferred_manufacturer.toLowerCase()
    );
    if (matching.length > 0) {
      matching.sort((a, b) => a.rental_czk_per_prop_day - b.rental_czk_per_prop_day);
      return matching[0];
    }
    // No match → fall through to cheapest overall
  }

  // Sort by rental cost (cheapest first)
  candidates.sort((a, b) => a.rental_czk_per_prop_day - b.rental_czk_per_prop_day);
  return candidates[0];
}

export function calculateProps(input: PropsCalculatorInput): PropsCalculatorResult {
  const warnings: string[] = [];
  const log: string[] = [];

  const crew = input.crew_size ?? 4;
  const shift = input.shift_h ?? 10;
  const k = input.k ?? 0.8;
  const wage = input.wage_czk_h ?? 398;
  const buffer = input.buffer_days ?? 2;

  // Grid spacing
  const gridDefault = PROP_GRID_DEFAULTS[input.element_type];
  const grid = input.grid_spacing_m ?? gridDefault?.grid_m ?? 1.5;
  log.push(`Grid: ${grid}m (${gridDefault?.description ?? 'default 1.5m'})`);

  // Prop system selection — pass formwork manufacturer as vendor hint
  const system = selectPropSystem(input.height_m, input.prop_system_name, input.formwork_manufacturer);
  log.push(`System: ${system.name} (${system.manufacturer}), ${system.min_height_m}–${system.max_height_m}m`
    + (input.formwork_manufacturer ? ` [vendor hint: ${input.formwork_manufacturer}]` : ''));

  if (input.height_m < system.min_height_m || input.height_m > system.max_height_m) {
    warnings.push(
      `Výška ${input.height_m}m je mimo rozsah systému ${system.name} ` +
      `(${system.min_height_m}–${system.max_height_m}m). Zkontrolujte výběr podpěrného systému.`
    );
  }

  // Number of props
  const gridArea = grid * grid;
  const numPropsPerTact = Math.ceil(input.formwork_area_m2 / gridArea);
  log.push(`Props/tact: ceil(${input.formwork_area_m2}m² / ${gridArea}m²) = ${numPropsPerTact}`);

  // For monolithic (1 tact) — all props at once
  // For sectional — props rotate between tacts (limited by hold_days)
  // If hold_days > assembly+disassembly, props can't rotate fast → need full set
  const totalPropsNeeded = numPropsPerTact; // one full set (hold_days prevent rotation)
  log.push(`Total props: ${totalPropsNeeded} (1 set, hold prevents fast rotation)`);

  // Assembly / disassembly time
  const asmHours = roundTo(numPropsPerTact * system.assembly_h_per_prop, 2);
  const disHours = roundTo(numPropsPerTact * system.disassembly_h_per_prop, 2);
  const asmDays = roundTo(asmHours / (crew * shift * k), 2);
  const disDays = roundTo(disHours / (crew * shift * k), 2);
  log.push(`Assembly: ${asmHours}h = ${asmDays}d, Disassembly: ${disHours}h = ${disDays}d`);

  // Rental duration
  // Props stay for: assembly + hold_days (per last tact) + disassembly + buffer
  const rentalDays = Math.ceil(asmDays + input.hold_days + disDays + buffer);
  const rentalCostCZK = roundTo(totalPropsNeeded * system.rental_czk_per_prop_day * rentalDays, 0);
  log.push(`Rental: ${totalPropsNeeded} × ${system.rental_czk_per_prop_day} Kč/d × ${rentalDays}d = ${rentalCostCZK} Kč`);

  // Labor cost: assembly + disassembly per tact × num_tacts
  const totalLaborH = (asmHours + disHours) * input.num_tacts;
  const laborCostCZK = roundTo(totalLaborH * wage, 0);
  log.push(`Labor: (${asmHours}+${disHours})h × ${input.num_tacts} tacts × ${wage} Kč/h = ${laborCostCZK} Kč`);

  // Weight
  const totalWeightKg = totalPropsNeeded * system.weight_kg;
  const craneNeeded = totalWeightKg > 500 || input.height_m > 5;

  if (craneNeeded) {
    // Terminology Commit 6 (2026-04-17): "Stojky" (props/věže) replaces
    // "Podpěry" to match the UI card split — Skruž (nosníky) vs Stojky
    // (věže) are now separate layers.
    warnings.push(
      `Stojky (${system.name}): celková hmotnost ${(totalWeightKg / 1000).toFixed(1)} t — vyžaduje jeřáb pro montáž/demontáž.`
    );
  }

  if (input.height_m > 6) {
    warnings.push(
      `Výška stojek ${input.height_m}m > 6m: vyžaduje podpěrné věže (${system.name}) ` +
      `se stabilizačními ztužidly. Kontrola dle ČSN EN 12812.`
    );
  }

  return {
    needed: true,
    system,
    grid_spacing_m: grid,
    num_props_per_tact: numPropsPerTact,
    total_props_needed: totalPropsNeeded,
    assembly_hours: asmHours,
    disassembly_hours: disHours,
    assembly_days: asmDays,
    disassembly_days: disDays,
    labor_hours: roundTo(totalLaborH, 2),  // total across all tacts (montáž + demontáž)
    hold_days: input.hold_days,
    rental_days: rentalDays,
    rental_cost_czk: rentalCostCZK,
    labor_cost_czk: laborCostCZK,
    total_cost_czk: rentalCostCZK + laborCostCZK,
    total_weight_kg: totalWeightKg,
    crane_needed: craneNeeded,
    warnings,
    log,
  };
}
