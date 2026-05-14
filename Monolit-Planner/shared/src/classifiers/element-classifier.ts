/**
 * Element Classifier v1.0
 *
 * Classifies construction elements by name/description and provides:
 * - Structural element type
 * - Recommended formwork system(s)
 * - Typical rebar ratio (kg/m³)
 * - Assembly difficulty factor
 * - Required auxiliary systems (supports, platforms, crane)
 * - Curing strip strength requirement
 *
 * Used by: Planner Orchestrator, Formwork Engine, Rebar Lite, Pour Task Engine
 */

import type { StructuralElementType } from '../calculators/pour-decision.js';
import type { FormworkSystemSpec } from '../constants-data/formwork-systems.js';
import { FORMWORK_SYSTEMS } from '../constants-data/formwork-systems.js';
import type { PourMethod, FormworkFilterResult, ConcreteConsistency } from '../calculators/lateral-pressure.js';
import { calculateLateralPressure, filterFormworkByPressure, inferPourMethod } from '../calculators/lateral-pressure.js';

// ─── Rebar labor-rate category (BUG A, v4.24) ────────────────────────────────

/**
 * Four rebar-category buckets matching methvin.co production-rate tables.
 * Labor norm (h/t) depends on element category × bar diameter.
 *
 *   slabs_foundations — horizontal, open access, fastest (slabs, patky, mostovka)
 *   walls             — vertical, moderate (opěrné zdi, stěny, opěry, křídla)
 *   beams_columns     — complex cages, slowest for main bars (pilíře, trámy)
 *   staircases        — tight geometry (schody, římsy — most labor per tonne)
 *
 * See `REBAR_RATES_MATRIX` at bottom of file for rates.
 */
export type RebarCategory =
  | 'slabs_foundations'
  | 'walls'
  | 'beams_columns'
  | 'staircases';

// ─── Element Profile ─────────────────────────────────────────────────────────

export interface ElementProfile {
  /** Classified element type */
  element_type: StructuralElementType;
  /** Czech label */
  label_cs: string;
  /** Confidence of classification (0–1) */
  confidence: number;

  // --- Formwork ---
  /** Recommended formwork systems (best first) */
  recommended_formwork: string[];
  /** Assembly difficulty factor (1.0 = standard, <1 easier, >1 harder) */
  difficulty_factor: number;
  /** Whether support structures needed (podpěry, stojky, věže) */
  needs_supports: boolean;
  /** Whether working platforms needed (pracovní plošiny) */
  needs_platforms: boolean;
  /** Whether crane required for formwork operations */
  needs_crane: boolean;
  /** Whether formwork is needed at all (default true; false for podkladní beton, pilota) */
  needs_formwork?: boolean;

  // --- Rebar ---
  /** Typical reinforcement ratio kg/m³ (midpoint) */
  rebar_ratio_kg_m3: number;
  /** Min–max rebar ratio range */
  rebar_ratio_range: [number, number];
  /**
   * Legacy per-element rebar labor norm (h/t) — used as fallback when no
   * diameter+category match in `REBAR_RATES_MATRIX`. Kept for backward compat.
   */
  rebar_norm_h_per_t: number;
  /**
   * Rebar labor-rate category (v4.24 — BUG A fix). Maps to `REBAR_RATES_MATRIX`
   * for diameter-aware lookup. Sources: methvin.co production rates (April 2026),
   * ČSN 73 0210, RSMeans labor-hour norms.
   */
  rebar_category: RebarCategory;
  /**
   * Default rebar main-bar diameter (mm) when user doesn't specify.
   * Values per typical Czech civil engineering practice — e.g. opěrné zdi D12,
   * mostovky D20, mostní pilíře D25, piloty longitudinal D20.
   */
  rebar_default_diameter_mm: number;

  // --- Curing ---
  /** Required strip strength as % of f_ck */
  strip_strength_pct: number;
  /** Element orientation for curing model: vertical strips faster */
  orientation: 'horizontal' | 'vertical';

  // --- Pour ---
  /** Typical pour rate constraint (m³/h) — element-specific limit */
  max_pour_rate_m3_h: number;
  /** Whether pump is typically needed */
  pump_typical: boolean;

  // --- Classification metadata (optional, populated by OTSKP match) ---
  /** Source of classification: 'otskp' (catalog match) | 'keywords' (regex) */
  classification_source?: 'otskp' | 'keywords';
  /** Concrete class detected from name (e.g. 'C30/37') */
  concrete_class_detected?: string;
  /** Prestressed concrete detected from name */
  is_prestressed_detected?: boolean;
  /** Bridge deck subtype detected from name */
  bridge_deck_subtype_detected?: string;
  /** Composite element — contains křídla */
  has_kridla_detected?: boolean;
  /** Prefabricated element (info only — calculator doesn't compute prefab) */
  is_prefab?: boolean;
}

// ─── Element Catalog ─────────────────────────────────────────────────────────

const ELEMENT_CATALOG: Record<StructuralElementType, Omit<ElementProfile, 'element_type' | 'confidence'>> = {
  zaklady_piliru: {
    label_cs: 'Základy pilířů / patky',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 14,
    recommended_formwork: ['Frami Xlife', 'DOMINO', 'Tradiční tesařské'],
    difficulty_factor: 0.9,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    // BUG 4: raised 100→120, real bridge patky 120-150 (B500B + CHA roury + kotvení)
    rebar_ratio_kg_m3: 120,
    rebar_ratio_range: [100, 150],
    rebar_norm_h_per_t: 40,
    strip_strength_pct: 50,
    // BUG-Z1 (2026-04-15): základová patka je horizontální prvek (H < B, H < L).
    // 'vertical' dříve spouštěla lateral-pressure engine, který pro patku
    // nemá smysl (tlak se rozptýlí do podloží). Horizontal = formwork
    // je obvodový věnec bez DIN 18218 filtrace.
    orientation: 'horizontal',
    max_pour_rate_m3_h: 40,
    pump_typical: true,
  },
  // Phase 3 Gate 2a (2026-04-30): zaklady_oper added as separate mostní type
  // paralelní k zaklady_piliru. Logic identical (same horizontal foundation
  // characteristics — Frami Xlife rámové bednění, no supports, same rebar
  // ratios). Only label_cs differs ("Základy opěr" vs "Základy pilířů /
  // patky"). Per Option α (full literal parallel entry per existing
  // convention — no shared profile constants in catalog).
  zaklady_oper: {
    label_cs: 'Základy opěr',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 14,
    recommended_formwork: ['Frami Xlife', 'DOMINO', 'Tradiční tesařské'],
    difficulty_factor: 0.9,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 120,
    rebar_ratio_range: [100, 150],
    rebar_norm_h_per_t: 40,
    strip_strength_pct: 50,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 40,
    pump_typical: true,
  },
  driky_piliru: {
    label_cs: 'Dříky pilířů / sloupy',
    rebar_category: 'beams_columns',
    rebar_default_diameter_mm: 25,
    recommended_formwork: ['VARIO GT 24', 'TRIO', 'QUATTRO', 'SL-1 Sloupové', 'Framax Xlife'],
    difficulty_factor: 1.1,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 150,
    rebar_ratio_range: [100, 200],
    rebar_norm_h_per_t: 55,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 25,
    pump_typical: true,
  },
  rimsa: {
    label_cs: 'Římsa',
    rebar_category: 'staircases',
    rebar_default_diameter_mm: 10,
    recommended_formwork: ['Římsové bednění T', 'Římsový vozík TU', 'Římsový vozík T'],
    difficulty_factor: 1.15,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 120,
    rebar_ratio_range: [100, 180],
    rebar_norm_h_per_t: 50,
    strip_strength_pct: 70,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 20,
    pump_typical: true,
  },
  operne_zdi: {
    label_cs: 'Opěrné zdi',
    rebar_category: 'walls',
    rebar_default_diameter_mm: 12,
    recommended_formwork: ['TRIO', 'Framax Xlife', 'MAXIMO', 'Frami Xlife'],
    // v4.24 BUG D (2026-04-20): 1.0 → 1.2. Opěrné zdi mají inverted-T průřez
    // + často římsy + šikmé stěny (dle sklonu rubové hrany) → vyšší pracnost
    // bednění než rovná stěna budovy. User spec: 1.0–1.2 range, 1.2 default.
    difficulty_factor: 1.2,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 90,
    rebar_ratio_range: [60, 120],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 35,
    pump_typical: true,
  },
  mostovkova_deska: {
    label_cs: 'Mostovková deska',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 20,
    recommended_formwork: ['MULTIFLEX', 'Top 50', 'Dokaflex'],
    difficulty_factor: 1.2,
    needs_supports: true,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 150,
    rebar_ratio_range: [120, 180],
    rebar_norm_h_per_t: 50,
    strip_strength_pct: 70,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 30,
    pump_typical: true,
  },
  rigel: {
    label_cs: 'Příčník / hlavice pilíře',
    rebar_category: 'beams_columns',
    rebar_default_diameter_mm: 25,
    recommended_formwork: ['VARIO GT 24', 'Framax Xlife', 'TRIO', 'Tradiční tesařské'],
    difficulty_factor: 1.1,
    needs_supports: true,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 140,
    rebar_ratio_range: [110, 170],
    rebar_norm_h_per_t: 55,
    strip_strength_pct: 70,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 25,
    pump_typical: true,
  },
  opery_ulozne_prahy: {
    label_cs: 'Opěry, úložné prahy',
    rebar_category: 'walls',
    rebar_default_diameter_mm: 16,
    recommended_formwork: ['TRIO', 'Framax Xlife', 'DOMINO', 'Frami Xlife'],
    difficulty_factor: 1.0,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    // BUG 5: raised 100→140, opěry jsou hustě vyztužené (dřík+prah+zídka+křídla)
    rebar_ratio_kg_m3: 140,
    rebar_ratio_range: [120, 180],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 35,
    pump_typical: true,
  },
  kridla_opery: {
    label_cs: 'Křídla mostních opěr',
    rebar_category: 'walls',
    rebar_default_diameter_mm: 12,
    recommended_formwork: ['Frami Xlife', 'Framax Xlife'],
    difficulty_factor: 0.9,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: false, // Frami = ruční; Framax potřebuje jeřáb ale jen pro h>3m
    rebar_ratio_kg_m3: 90,
    rebar_ratio_range: [70, 120],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 35,
    pump_typical: false,
  },
  mostni_zavirne_zidky: {
    label_cs: 'Mostní závěrné zídky',
    rebar_category: 'walls',
    rebar_default_diameter_mm: 12,
    recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
    difficulty_factor: 0.85,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 80,
    rebar_ratio_range: [60, 100],
    rebar_norm_h_per_t: 40,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 30,
    pump_typical: false,
  },
  prechodova_deska: {
    label_cs: 'Přechodová deska',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 14,
    recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
    difficulty_factor: 0.9,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 90,
    rebar_ratio_range: [80, 100],
    rebar_norm_h_per_t: 40,
    strip_strength_pct: 50,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 35,
    pump_typical: true,
  },
  // ─── Building elements (pozemní stavby) ────────────────────────────────────

  zakladova_deska: {
    label_cs: 'Základová deska',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 14,
    recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
    difficulty_factor: 0.85,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 110,
    rebar_ratio_range: [80, 140],
    rebar_norm_h_per_t: 40,
    strip_strength_pct: 50,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 40,
    pump_typical: true,
  },
  zakladovy_pas: {
    label_cs: 'Základový pás',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 14,
    recommended_formwork: ['Frami Xlife', 'DOMINO', 'Tradiční tesařské'],
    difficulty_factor: 0.8,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 80,
    rebar_ratio_range: [50, 110],
    rebar_norm_h_per_t: 35,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 40,
    pump_typical: true,
  },
  zakladova_patka: {
    label_cs: 'Základová patka',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 14,
    recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
    difficulty_factor: 0.8,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 90,
    rebar_ratio_range: [60, 120],
    rebar_norm_h_per_t: 35,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 40,
    pump_typical: true,
  },
  stropni_deska: {
    label_cs: 'Stropní deska / podlahová deska',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 12,
    recommended_formwork: ['Dokaflex', 'SKYDECK', 'Top 50'],
    difficulty_factor: 1.0,
    needs_supports: true,   // stojky / podpěry
    needs_platforms: false,
    needs_crane: true,
    rebar_ratio_kg_m3: 120,
    rebar_ratio_range: [80, 160],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 70,  // horizontal — higher strip strength
    orientation: 'horizontal',
    max_pour_rate_m3_h: 35,
    pump_typical: true,
  },
  stena: {
    label_cs: 'Monolitická stěna',
    rebar_category: 'walls',
    rebar_default_diameter_mm: 12,
    recommended_formwork: ['Framax Xlife', 'MAXIMO', 'TRIO', 'Frami Xlife'],
    difficulty_factor: 1.0,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 80,
    rebar_ratio_range: [50, 120],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 30,
    pump_typical: true,
  },
  sloup: {
    label_cs: 'Sloup',
    rebar_category: 'beams_columns',
    rebar_default_diameter_mm: 16,
    recommended_formwork: ['SL-1 Sloupové', 'QUATTRO', 'SRS', 'Framax Xlife'],
    difficulty_factor: 1.1,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 160,
    rebar_ratio_range: [120, 220],
    rebar_norm_h_per_t: 55,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 20,
    pump_typical: true,
  },
  pruvlak: {
    label_cs: 'Průvlak / trám',
    rebar_category: 'beams_columns',
    rebar_default_diameter_mm: 16,
    recommended_formwork: ['Dokaflex', 'Tradiční tesařské'],
    difficulty_factor: 1.15,
    needs_supports: true,   // skruž / podpěry
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 140,
    rebar_ratio_range: [100, 180],
    rebar_norm_h_per_t: 55,
    strip_strength_pct: 70,  // horizontal
    orientation: 'horizontal',
    max_pour_rate_m3_h: 25,
    pump_typical: true,
  },
  schodiste: {
    label_cs: 'Schodiště',
    rebar_category: 'staircases',
    rebar_default_diameter_mm: 10,
    recommended_formwork: ['Tradiční tesařské', 'Dokaflex'],
    difficulty_factor: 1.3,   // complex formwork (sloped + steps)
    needs_supports: true,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 130,
    rebar_ratio_range: [100, 170],
    rebar_norm_h_per_t: 60,
    strip_strength_pct: 70,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 15,
    pump_typical: true,
  },
  nadrz: {
    label_cs: 'Nádrž / jímka / bazén',
    rebar_category: 'walls',
    rebar_default_diameter_mm: 16,
    recommended_formwork: ['Framax Xlife', 'RUNDFLEX', 'Frami Xlife'],
    difficulty_factor: 1.1,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 100,
    rebar_ratio_range: [70, 140],
    rebar_norm_h_per_t: 50,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 25,
    pump_typical: true,
  },
  podzemni_stena: {
    label_cs: 'Podzemní stěna (milánská)',
    rebar_category: 'walls',
    rebar_default_diameter_mm: 16,
    recommended_formwork: ['Tradiční tesařské'],  // usually no traditional formwork — guide walls + bentonite
    difficulty_factor: 1.3,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 80,
    rebar_ratio_range: [50, 120],
    rebar_norm_h_per_t: 50,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 20,
    pump_typical: true,
  },
  pilota: {
    label_cs: 'Pilota / mikropilota',
    rebar_category: 'beams_columns',
    rebar_default_diameter_mm: 20,
    recommended_formwork: ['Tradiční tesařské'],  // no formwork — bored pile
    difficulty_factor: 0.7,   // no formwork work
    needs_supports: false,
    needs_platforms: false,
    needs_crane: true,
    rebar_ratio_kg_m3: 60,
    rebar_ratio_range: [40, 100],
    rebar_norm_h_per_t: 30,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 30,
    pump_typical: false,   // tremie pipe, not pump
  },
  // ─── BUG 11: New bridge element types ──────────────────────────────────────
  podkladni_beton: {
    label_cs: 'Podkladní beton',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 10,
    recommended_formwork: ['Tradiční tesařské'],
    difficulty_factor: 0.5,   // simple plain concrete, no rebar
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    needs_formwork: false,    // poured directly on excavation / terrain
    rebar_ratio_kg_m3: 0,     // prostý beton — no reinforcement
    rebar_ratio_range: [0, 0],
    rebar_norm_h_per_t: 0,
    strip_strength_pct: 50,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 50,
    pump_typical: true,
  },
  podlozkovy_blok: {
    label_cs: 'Podložiskový blok',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 14,
    recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
    difficulty_factor: 1.2,   // small but precisely placed, dense rebar
    needs_supports: false,
    needs_platforms: true,
    needs_crane: false,
    rebar_ratio_kg_m3: 180,   // very dense reinforcement (anchor bars + ties)
    rebar_ratio_range: [150, 220],
    rebar_norm_h_per_t: 60,
    strip_strength_pct: 50,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 15,
    pump_typical: true,
  },
  other: {
    label_cs: 'Jiný monolitický prvek',
    rebar_category: 'slabs_foundations',
    rebar_default_diameter_mm: 12,
    recommended_formwork: ['Frami Xlife'],
    difficulty_factor: 1.0,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 100,
    rebar_ratio_range: [60, 150],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 30,
    pump_typical: true,
  },
};

// ─── OTSKP catalog mapping (confidence=1.0, highest priority) ──────────────

interface OtskpRule {
  pattern: RegExp;
  element_type: StructuralElementType;
  metadata?: {
    bridge_deck_subtype?: string;
    has_kridla?: boolean;
    is_prefab?: boolean;
  };
}

/**
 * OTSKP→element_type mapping table.
 * Checked BEFORE keyword rules. Patterns match normalized (lowercased) OTSKP names.
 * Order matters — first match wins.
 */
const OTSKP_RULES: OtskpRule[] = [
  // ─── Mostovková deska subtypes ───
  { pattern: /mostn[ií]\s*nosn[eéa]\s*deskove|mostn[ií]\s*nosn[eéa]\s*desk\s*konstr/,
    element_type: 'mostovkova_deska', metadata: { bridge_deck_subtype: 'deskovy' } },
  { pattern: /mostn[ií]\s*nosn[eéa]\s*tram\s*konstr|mostn[ií]\s*nosn[eéa]\s*trám/,
    element_type: 'mostovkova_deska', metadata: { bridge_deck_subtype: 'dvoutram' } },
  { pattern: /mostn[ií]\s*nosn[eéa]\s*komorov/,
    element_type: 'mostovkova_deska', metadata: { bridge_deck_subtype: 'jednokomora' } },
  { pattern: /mostn[ií]\s*nosn[ií]ky\s*z\s*d[ií]lc[uů]|nosn[ií]ky\s*z\s*d[ií]lc/,
    element_type: 'mostovkova_deska', metadata: { is_prefab: true } },
  // ─── Opěry ───
  { pattern: /mostn[ií]\s*op[eě]ry\s*(a\s*)?k[rř][ií]dl/,
    element_type: 'opery_ulozne_prahy', metadata: { has_kridla: true } },
  { pattern: /mostn[ií]\s*op[eě]ry/,
    element_type: 'opery_ulozne_prahy' },
  // ─── Pilíře ───
  { pattern: /mostn[ií]\s*pil[ií][rř]e?\s*(a\s*)?stativ/,
    element_type: 'driky_piliru' },
  // ─── Římsy ───
  { pattern: /[rř][ií]msy|[rř][ií]msov/,
    element_type: 'rimsa' },
  // ─── Přechodové desky ───
  { pattern: /p[rř]echodov[eéa]\s*desk/,
    element_type: 'prechodova_deska' },
  // ─── Závěrné zídky ───
  { pattern: /z[aá]v[eě]rn[eéa]\s*z[ií]dk/,
    element_type: 'mostni_zavirne_zidky' },
  // ─── Křídla (standalone) ───
  { pattern: /k[rř][ií]dl[oa]\s+op[eě]r|k[rř][ií]dl[oa]\s+most/,
    element_type: 'kridla_opery' },
];

/**
 * Extract metadata from OTSKP element name.
 * Detects concrete class, prestress, and material type.
 */
export function extractOtskpMetadata(name: string): {
  concrete_class?: string;
  is_prestressed?: boolean;
  is_prefab?: boolean;
} {
  const n = name.toUpperCase();
  const result: { concrete_class?: string; is_prestressed?: boolean; is_prefab?: boolean } = {};

  // Concrete class: C20/25, C30/37, C35/45, C40/50
  const ccMatch = n.match(/C(\d{2})\/(\d{2,3})/);
  if (ccMatch) result.concrete_class = `C${ccMatch[1]}/${ccMatch[2]}`;

  // Prestressed vs reinforced vs plain
  if (/PŘEDPJ|PŘEDPĚT|PŘEPJ|PREDPJ/.test(n)) {
    result.is_prestressed = true;
  } else if (/ŽELEZOB|ŽELEZOVÉHO/.test(n)) {
    result.is_prestressed = false;
  } else if (/PROST\s*BET|PROSTÉHO/.test(n)) {
    result.is_prestressed = false;
  }

  // Prefab
  if (/Z\s*DÍLCŮ|Z\s*DILCU/.test(n)) {
    result.is_prefab = true;
  }

  return result;
}

// ─── Keyword-based classification ────────────────────────────────────────────

interface KeywordRule {
  element_type: StructuralElementType;
  keywords: string[];
  /** Higher priority wins when multiple rules match */
  priority: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  // ─── Bridge elements (higher priority) ───
  {
    element_type: 'mostovkova_deska',
    keywords: [
      'mostovka', 'mostovkov', 'mostova deska', 'mostní deska', 'mostni deska',
      'deska mostu', 'nosna konstrukce', 'nosná konstrukce', 'bridge deck',
      'nosne tram', 'nosné trám', 'nosna konstr', 'nosná konstr',
      'predpj bet', 'předpj bet', 'predpjat', 'předpjat',
      'nosnik most', 'nosník most', 'podelny nosnik', 'podélný nosník',
      'mostni svrsek', 'mostní svršek', 'superstructure',
      'hlavni nosnik', 'hlavní nosník', 'komorovy nosnik', 'komorový nosník',
      'deska nosne', 'deska nosné', 'nosna deska', 'nosná deska',
      'мостов', 'мостовая плита', 'пролетное строение',
    ],
    priority: 10,
  },
  { element_type: 'rimsa', keywords: [
    'rimsa', 'říms', 'rimsov', 'rimsova deska', 'římsová deska',
    'zabradeln zid', 'zábradelní zíd', 'zabradel', 'zábradel',
    'parapet', 'cornice', 'coping',
    'римс', 'карниз',
  ], priority: 10 },
  { element_type: 'prechodova_deska', keywords: [
    'prechodova deska', 'přechodová deska', 'prechodove desky', 'přechodové desky',
    'prechodov', 'přechodov', 'transition slab', 'approach slab',
  ], priority: 11 },
  { element_type: 'mostni_zavirne_zidky', keywords: [
    'zavirn', 'závěrn', 'zavirne zidky', 'závěrné zídky',
    'zidka most', 'zídka most',
    'closure wall', 'end wall',
  ], priority: 9 },
  { element_type: 'rigel', keywords: [
    'pricnik', 'příčník', 'pricni', 'příčn',
    'pricnik most', 'příčník most',
    'rigel', 'ригель',
    'hlavice pilir', 'hlavice pilíř', 'hlavic', 'pier cap', 'crossbeam',
    'diafragm', 'diaphragm',
  ], priority: 9 },
  { element_type: 'zaklady_piliru', keywords: [
    'zaklad pilir', 'základ pilíř', 'zaklady piliru', 'základy pilířů',
    'zaklady', 'základy',
    'pilotov zaklad', 'pilotový základ',
    'zakladovy blok', 'základový blok', 'blok oper', 'blok opěr',
    'plosny zaklad most', 'plošný základ most',
    'фундамент опор', 'фундамент пилон',
  ], priority: 10 },
  // Phase 3 Gate 2a: zaklady_oper recognition. Higher priority than
  // zaklady_piliru so "základ opěry" specifically matches zaklady_oper
  // instead of falling through to the generic "základy" keyword. Other
  // "opěr"-related keywords (e.g. "blok opěr") stay with zaklady_piliru
  // to avoid changing existing classification behavior in this commit.
  { element_type: 'zaklady_oper', keywords: [
    'zaklad oper', 'základ opěr', 'zaklady oper', 'základy opěr',
    'opera zaklad', 'opěra základ', 'opery zaklad', 'opěry základ',
    'mostni opera zaklad', 'mostní opěra základ',
    'zaklad mostni opery', 'základ mostní opěry',
  ], priority: 11 },
  { element_type: 'driky_piliru', keywords: [
    'drik', 'dřík', 'driky pilir', 'dříky pilíř',
    'pilir most', 'pilíř most',
    'mostni pilir', 'mostní pilíř', 'mostni pilire', 'mostní pilíře',
    'stativ', 'stativa',
    'telo pilir', 'tělo pilíř', 'telo oper', 'tělo opěr',
    'pier stem', 'pier shaft', 'pylon',
    'тело опор', 'столб моста',
  ], priority: 8 },
  { element_type: 'operne_zdi', keywords: [
    'opern', 'opěrn', 'operna zed', 'opěrná zeď',
    'operne zdi most', 'opěrné zdi most',
    // P0 BUG #1 fix (2026-05-14, SO-250 audit): zárubní zeď (cut/anchored
    // retaining wall) is structurally the same family as opěrná zeď —
    // engine should reach for the same vertical-wall formwork systems
    // (TRIO/Framax) and difficulty_factor. Without these keywords the
    // dřík of a zárubní zeď fell through to 'other' on a part_name that
    // lacked the word "opěrná".
    'zarubn', 'zárubn',
    'zarubni zed', 'zárubní zeď',
    'kotven zed', 'kotvená zeď',
    'gabionov', 'gabion',
    'retaining wall',
    'подпорн стен',
  ], priority: 8 },
  { element_type: 'kridla_opery', keywords: [
    'kridl', 'křídl', 'kridla', 'křídla', 'křídlo',
    'wing wall', 'mostni kridl', 'mostní křídl',
  ], priority: 9 },
  { element_type: 'opery_ulozne_prahy', keywords: [
    'opera', 'opěra', 'opery', 'opěry',
    'ulozn', 'úložn', 'ulozne prah', 'úložné prah',
    'prah', 'sedlo',
    'mostni oper', 'mostní opěr', 'mostni opery', 'mostní opěry',
    'abutment', 'bearing seat',
  ], priority: 7 },

  // ─── Building elements ───
  { element_type: 'stropni_deska', keywords: [
    'stropni', 'stropní', 'strop', 'podlah', 'podlažní', 'floor slab',
    'перекрыт', 'плита перекрыт', 'монолитн перекрыт',
  ], priority: 7 },
  { element_type: 'zakladova_deska', keywords: [
    'zakladova deska', 'základová deska', 'zakladni deska', 'základní deska',
    'foundation slab', 'фундаментн плит', 'фундаментн деск',
  ], priority: 9 },
  { element_type: 'zakladovy_pas', keywords: [
    'zakladovy pas', 'základový pás', 'zakladove pasy', 'základové pásy',
    'zaklady', 'základy',
    'strip found', 'ленточн фундамент',
  ], priority: 9 },
  { element_type: 'zakladova_patka', keywords: [
    'patka', 'patky', 'zakladova patka', 'základová patka', 'pad found',
    'столбчат фундамент',
  ], priority: 8 },
  { element_type: 'stena', keywords: [
    'stena', 'stěna', 'zed', 'zeď', 'jadro', 'jádro', 'core wall', 'shear wall',
    'стена', 'монолитн стен', 'ядро жесткости',
  ], priority: 6 },
  { element_type: 'sloup', keywords: [
    'sloup', 'pilir', 'pilíř', 'column', 'pillar',
    'колонн', 'столб', 'пилон',
  ], priority: 6 },
  { element_type: 'pruvlak', keywords: [
    'pruvlak', 'průvlak', 'tram', 'trám', 'beam', 'girder', 'preklad', 'překlad',
    'nosnik', 'nosník',
    'балк', 'прогон', 'ригель здан',
  ], priority: 6 },
  { element_type: 'schodiste', keywords: [
    'schodist', 'schodiště', 'schody', 'staircase', 'stairs', 'stupne', 'stupně',
    'лестниц',
  ], priority: 8 },
  { element_type: 'nadrz', keywords: [
    'nadrz', 'nádrž', 'jimka', 'jímka', 'bazen', 'bazén', 'nadoba', 'nádoba',
    'tank', 'reservoir', 'pool', 'vodojem',
    'резервуар', 'ёмкость', 'бассейн', 'отстойник',
  ], priority: 8 },
  { element_type: 'podzemni_stena', keywords: [
    'podzemni stena', 'podzemní stěna', 'milansk', 'milánsk', 'diaphragm wall',
    'стена в грунт', 'милан',
  ], priority: 9 },
  { element_type: 'pilota', keywords: [
    'pilota', 'piloty', 'mikropilot', 'vrtana pilota', 'vrtaná pilota', 'bored pile',
    'свая', 'буронабивн',
  ], priority: 8 },
  // BUG 11: new element types
  { element_type: 'podkladni_beton', keywords: [
    'podkladni beton', 'podkladní beton', 'podklad beton', 'podbet',
    'lean concrete', 'blinding',
    // OTSKP forms: "PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C25/30"
    'podkladni a vyplnove', 'podkladní a výplňové',
    'vyplnove vrstvy', 'výplňové vrstvy',
    'podkl vrst',  // abbreviated OTSKP "PODKL VRSTVY Z(E)..."
  ], priority: 7 },
  { element_type: 'podlozkovy_blok', keywords: [
    'podlozkovy blok', 'podložiskový blok', 'podlozisk', 'podložisk',
    'bearing block', 'bearing pad', 'loziskovy blok', 'ložiskový blok',
    'blok pod lozisko', 'blok pod ložisko',
  ], priority: 9 },
];

/**
 * Normalize Czech text for keyword matching: lowercase + strip diacritics
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─── Main API ────────────────────────────────────────────────────────────────

/** Bridge element types — get priority boost in bridge context */
const BRIDGE_ELEMENT_TYPES = new Set<StructuralElementType>([
  'zaklady_piliru', 'zaklady_oper', 'driky_piliru', 'rimsa', 'operne_zdi',
  'mostovkova_deska', 'rigel', 'opery_ulozne_prahy', 'kridla_opery',
  'mostni_zavirne_zidky', 'prechodova_deska',
]);

/** Building element types that have bridge equivalents */
const BRIDGE_EQUIVALENT: Partial<Record<StructuralElementType, StructuralElementType>> = {
  sloup: 'driky_piliru',              // "pilíř" in bridge context = dříky pilířů, not sloup
  zakladova_deska: 'zaklady_piliru',  // "základy" in bridge context = základy pilířů
  zakladovy_pas: 'zaklady_piliru',
  zakladova_patka: 'zaklady_piliru',  // "patky" in bridge context = základy pilířů
  stropni_deska: 'mostovkova_deska',  // "deska" in bridge context = mostovková deska
  pruvlak: 'rigel',                   // "trám/nosník" in bridge context = příčník
  stena: 'operne_zdi',                // "stěna" in bridge context = opěrná zeď
};

/** Classification context — optional hints to improve accuracy */
export interface ClassificationContext {
  /** Is this element part of a bridge/mostní objekt? (SO-xxx prefix, bridge_id present) */
  is_bridge?: boolean;
}

/**
 * Classify a construction element by name/description.
 *
 * @param name - Part name or description (Czech), e.g. "ZÁKLADY PILÍŘŮ", "Mostovková deska"
 * @param context - Optional context (is_bridge) to resolve ambiguities like pilíř vs sloup
 * @returns ElementProfile with all defaults and recommendations
 */
export function classifyElement(name: string, context?: ClassificationContext): ElementProfile {
  const normalized = normalize(name);
  const isBridge = context?.is_bridge ?? false;

  // ─── Early-exit rules: special materials/non-structural ───
  // PODKLADNÍ/VÝPLŇOVÉ = plain concrete → podkladni_beton (unless reinforced)
  if (/podkladn|podkl\b|vyplnov|vyplnov/.test(normalized)) {
    // Reinforced layers (železobeton, výztuž) are NOT plain podkladní beton
    if (/zelezobet|zelezobeton|vyztuz|armovan/.test(normalized)) {
      return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
    }
    return { element_type: 'podkladni_beton', confidence: 0.95, ...ELEMENT_CATALOG.podkladni_beton };
  }
  // STŘÍKANÝ = shotcrete, special technology
  if (/strikan|stříkan|torkret|nastrik|nástřik/.test(normalized)) {
    return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
  }
  // IZOLAČNÍ VRSTVY = insulation layers, no structural formwork
  if (/izolacn\s*vrst|izolační\s*vrst/.test(normalized)) {
    return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
  }
  // ZÁLIVKA SPÁR = joint grouting, no formwork
  if (/zalivk\s*spar|zálivk\s*spár|zalivkov|zálivkov/.test(normalized)) {
    return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
  }
  // MONOLITICKÁ VOZOVKA = road surface, not structural element
  if (/monolitick\S*\s*vozovk|betonov\S*\s*vozovk|betonový\s*kryt/.test(normalized)) {
    return { element_type: 'other', confidence: 0.9, ...ELEMENT_CATALOG.other };
  }

  // P0 BUG #1 disambiguation (2026-05-14, SO-250 audit):
  //   "Základy ze ŽB ... pro zárubní/opěrnou zeď"  →  zaklady_oper
  //
  // Without this rule, the keyword-scoring fallback below ties on the
  // generic "zaklady" substring and picks zaklady_piliru (bridge pier
  // foundation) — the wrong element family. Engine then loads Frami Xlife
  // vertical-wall formwork, foundation difficulty_factor 0.9, and the
  // slabs_foundations rebar matrix branch — all the symptoms documented in
  // docs/audits/calculator_field_audit/2026-05-14_full_ui_walkthrough.md.
  //
  // The disambiguation needs BOTH signals: a foundation word ("základ" /
  // "zaklad") AND a retaining-wall word ("opěrná" / "zárubní" / "kotvená").
  // When only the foundation word is present (e.g. plain OTSKP line
  // "Základy ze ŽB do C25/30" with no project context), we leave the
  // existing classifier flow alone — that case is part_name-context-free
  // and only a TZ-text upgrade will fix it; out of scope here.
  if (
    /(^|[^a-z])(zaklad|základ)/i.test(normalized) &&
    /(opern|opěrn|zarubn|zárubn|kotven)/i.test(normalized)
  ) {
    const catalog = ELEMENT_CATALOG.zaklady_oper;
    const meta = extractOtskpMetadata(name);
    return {
      element_type: 'zaklady_oper',
      confidence: 0.92,
      ...catalog,
      classification_source: 'keywords',
      ...(meta.concrete_class ? { concrete_class_detected: meta.concrete_class } : {}),
      ...(meta.is_prestressed !== undefined ? { is_prestressed_detected: meta.is_prestressed } : {}),
    };
  }

  // ─── OTSKP catalog match (confidence=1.0, highest priority) ───
  for (const rule of OTSKP_RULES) {
    if (rule.pattern.test(normalized)) {
      const catalog = ELEMENT_CATALOG[rule.element_type];
      const meta = extractOtskpMetadata(name);
      return {
        element_type: rule.element_type,
        confidence: 1.0,
        ...catalog,
        classification_source: 'otskp',
        concrete_class_detected: meta.concrete_class,
        is_prestressed_detected: meta.is_prestressed,
        is_prefab: meta.is_prefab || rule.metadata?.is_prefab,
        has_kridla_detected: rule.metadata?.has_kridla,
        bridge_deck_subtype_detected: rule.metadata?.bridge_deck_subtype,
      };
    }
  }

  // ─── Keyword scoring (fallback) ───
  let bestType: StructuralElementType = 'other';
  let bestScore = 0;
  let bestPriority = 0;

  for (const rule of KEYWORD_RULES) {
    let matchCount = 0;
    for (const kw of rule.keywords) {
      if (normalized.includes(normalize(kw))) {
        matchCount++;
      }
    }
    // Křídla: suppress when name contains both "opěr" and "křídl" (composite item = opěra)
    if (rule.element_type === 'kridla_opery' && matchCount > 0) {
      const hasOpera = /oper|opěr/.test(normalized);
      const isComposite = hasOpera && /kridl|křídl/.test(normalized);
      if (isComposite) matchCount = 0; // Let opery_ulozne_prahy handle it
    }
    // Podkladní beton: suppress when name indicates reinforced concrete
    // "PODKL VRSTVY ZE ŽELEZOBET DO C16/20 VČET VÝZTUŽE" = NOT plain concrete
    if (rule.element_type === 'podkladni_beton' && matchCount > 0) {
      if (/zelezobet|zelezobeton|vyztuz|armovan/.test(normalized)) {
        matchCount = 0;
      }
    }
    if (matchCount > 0) {
      // Bridge context: boost bridge element types by +5 priority
      const contextBoost = isBridge && BRIDGE_ELEMENT_TYPES.has(rule.element_type) ? 5 : 0;
      const score = matchCount * 10 + rule.priority + contextBoost;
      if (score > bestScore || (score === bestScore && (rule.priority + contextBoost) > bestPriority)) {
        bestScore = score;
        bestType = rule.element_type;
        bestPriority = rule.priority + contextBoost;
      }
    }
  }

  // Bridge context: remap building types to bridge equivalents
  if (isBridge && BRIDGE_EQUIVALENT[bestType]) {
    bestType = BRIDGE_EQUIVALENT[bestType]!;
  }

  const confidence = bestType === 'other' ? 0.3 : Math.min(1.0, 0.6 + bestScore * 0.04);
  const catalog = ELEMENT_CATALOG[bestType];
  const meta = extractOtskpMetadata(name);

  return {
    element_type: bestType,
    confidence,
    ...catalog,
    classification_source: 'keywords',
    ...(meta.concrete_class ? { concrete_class_detected: meta.concrete_class } : {}),
    ...(meta.is_prestressed !== undefined ? { is_prestressed_detected: meta.is_prestressed } : {}),
  };
}

/**
 * Get element profile by known type (no classification needed).
 */
export function getElementProfile(type: StructuralElementType): ElementProfile {
  const catalog = ELEMENT_CATALOG[type];
  return {
    element_type: type,
    confidence: 1.0,
    ...catalog,
  };
}

/**
 * Get recommended FormworkSystemSpec for an element type.
 *
 * When height_m is provided, applies pressure-based filtering:
 *   1. Calculate lateral pressure from height and pour method
 *   2. Get category-compatible systems (from getSuitableSystemsForElement)
 *   3. Filter by pressure capacity
 *   4. Return cheapest suitable system
 *
 * Without height_m, falls back to static recommendation (backward compatible).
 *
 * @param type - Element type
 * @param height_m - Element/pour height (m). Enables pressure-based selection.
 * @param pour_method - Concrete delivery method. Auto-inferred if not given.
 */
export function recommendFormwork(
  type: StructuralElementType,
  height_m?: number,
  pour_method?: PourMethod,
  total_length_m?: number,
  concrete_consistency?: ConcreteConsistency,
): FormworkSystemSpec {
  const profile = ELEMENT_CATALOG[type];

  // Rimsa: select formwork based on bridge length (konzoly vs. vozík)
  if (type === 'rimsa') {
    let systemName: string;
    if (total_length_m && total_length_m > 150) {
      systemName = 'Římsový vozík TU'; // long bridges → travelling carriage
    } else {
      systemName = 'Římsové bednění T'; // short bridges → bracket formwork
    }
    return FORMWORK_SYSTEMS.find(s => s.name === systemName)
      ?? FORMWORK_SYSTEMS.find(s => s.name === 'Římsové bednění T')
      ?? FORMWORK_SYSTEMS[0];
  }

  // Mostovka + tall clearance: return the FALSEWORK (nosníková skruž,
  // Top 50), NOT the props. The orchestrator adds props (Staxo 40/100)
  // separately via calculateProps(). Before pour_role taxonomy was
  // added (2026-04-17 Commit 1), this branch returned Staxo 100 — which
  // is a support tower (stojky), not bednění. The UI then showed
  // "📦 Bednění: Staxo 100" for bridge decks, conflating two layers.
  // Now it returns the skruž and calculateProps handles the věže.
  if (type === 'mostovkova_deska' && height_m != null && height_m > 4) {
    return FORMWORK_SYSTEMS.find(s => s.name === 'Top 50')
      ?? FORMWORK_SYSTEMS.find(s => s.name === 'VARIOKIT HD 200')
      ?? FORMWORK_SYSTEMS.find(s => s.name === profile.recommended_formwork[0])
      ?? FORMWORK_SYSTEMS[0];
  }

  // Pilota: bored pile — uses pažnice (casing) or tremie pipe, not panel formwork.
  // Skip pressure-based filtering entirely.
  if (type === 'pilota') {
    const systemName = profile.recommended_formwork[0];
    return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
  }

  // No height → static recommendation (original behavior)
  if (height_m == null || height_m <= 0) {
    const systemName = profile.recommended_formwork[0];
    return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
  }

  // Horizontal elements: lateral pressure is irrelevant (concrete sits ON formwork).
  // Select by category compatibility and rental price — no pressure filtering needed.
  if (profile.orientation === 'horizontal') {
    // Phase 3 Gate 2a (2026-04-30): respect canonical recommended_formwork[0]
    // over cheapest sort, when the recommended system is applicable.
    //
    // Background: prior to this fix, the horizontal branch returned the
    // cheapest-rental system from the category-compatible pool. For
    // foundations (zaklady_piliru, zaklady_oper, zakladova_deska),
    // Top 50 (380 Kč/m²/mo, formwork_category='slab') won over Frami Xlife
    // (~507 Kč/m²/mo, formwork_category='wall' — excluded from horizontal
    // pool by ELEMENT_SUITABLE_CATEGORIES). Result: foundations got Top 50
    // (mostovka-class nosníkové bednění) instead of Frami Xlife (rámové,
    // canonical per §9.4 + DOKA katalog).
    //
    // Fix: prefer ELEMENT_CATALOG[type].recommended_formwork[0] when:
    //  1. recommendation exists in profile,
    //  2. corresponding system exists in FORMWORK_SYSTEMS catalog,
    //  3. system is applicable for this element (allow-list logic):
    //     applicable_element_types absence = universal applicability
    //     (Frami Xlife, Top 50 etc. may be used for various element types);
    //     applicable_element_types as array = explicit allow-list
    //     (e.g., Top 50 Cornice for rimsa only).
    // Falls back to cheapest sort if any check fails.
    const recommendedName = profile.recommended_formwork?.[0];
    if (recommendedName) {
      const recommendedSystem = FORMWORK_SYSTEMS.find(s => s.name === recommendedName);
      if (recommendedSystem) {
        const isApplicable =
          !recommendedSystem.applicable_element_types
          || recommendedSystem.applicable_element_types.includes(type);
        if (isApplicable) {
          return recommendedSystem;
        }
      }
    }

    const { all: compatibleSystems } = getSuitableSystemsForElement(type);
    if (compatibleSystems.length > 0) {
      // Sort: cheapest rental first, 0-price (tradiční) last
      const sorted = [...compatibleSystems].sort((a, b) => {
        if (a.rental_czk_m2_month === 0 && b.rental_czk_m2_month > 0) return 1;
        if (b.rental_czk_m2_month === 0 && a.rental_czk_m2_month > 0) return -1;
        return a.rental_czk_m2_month - b.rental_czk_m2_month;
      });
      return sorted[0];
    }
    const systemName = profile.recommended_formwork[0];
    return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
  }

  // Vertical elements: use lateral pressure (DIN 18218) to filter formwork systems.
  const method = pour_method ?? inferPourMethod(profile.pump_typical, height_m);
  // BUG-1: default concrete consistency = 'standard' (k=0.85), not method-based.
  const consistency: ConcreteConsistency = concrete_consistency ?? 'standard';
  const pressure = calculateLateralPressure(height_m, method, { concrete_consistency: consistency });

  // Get category-compatible systems
  const { all: compatibleSystems } = getSuitableSystemsForElement(type);

  // Filter by pressure AND max pour height
  const filtered = filterFormworkByPressure(
    pressure.pressure_kn_m2,
    compatibleSystems,
    profile.orientation,
    height_m,
  );

  if (filtered.suitable.length > 0) {
    // Phase 3 Gate 2a (commit 3 of 4 — 2026-04-30): extend Option W
    // principle to vertical branch with pressure-filter safety preserved.
    //
    // Background (parallel to Commit 2 horizontal fix): vertical elements
    // returned the cheapest pressure-survivor (filtered.suitable[0]). For
    // opery_ulozne_prahy this picked COMAIN (ULMA) over canonical TRIO
    // (PERI) recommended[0]; for operne_zdi it picked DUO over TRIO.
    //
    // Fix: prefer ELEMENT_CATALOG.recommended_formwork[0] AMONG pressure-
    // survivors. DIN 18218 safety filter still applied first (filtered.
    // suitable is the pre-filtered pool); recommended[0] only wins if it
    // SURVIVED the pressure filter. If it failed pressure → fall back to
    // cheapest survivor (existing behavior preserved).
    //
    // Universal allow-list semantics not relevant here because filtered.
    // suitable already excludes systems whose applicable_element_types
    // exclude this type (handled upstream in getSuitableSystemsForElement
    // + filterFormworkByPressure pipeline).
    const recommendedName = profile.recommended_formwork?.[0];
    if (recommendedName) {
      const recommendedSurvivor = filtered.suitable.find(
        s => s.name === recommendedName,
      );
      if (recommendedSurvivor) {
        return recommendedSurvivor;
      }
    }
    return filtered.suitable[0]; // Cheapest survivor (existing fallback)
  }

  // Fallback: static recommendation (should rarely happen — tradiční is always available)
  const systemName = profile.recommended_formwork[0];
  return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
}

/**
 * Get pressure-filtered formwork systems for an element type.
 * Returns the full filter result (suitable, rejected, pressure).
 * Used by orchestrator for warnings and UI display.
 */
export function getFilteredFormworkSystems(
  type: StructuralElementType,
  height_m: number,
  pour_method?: PourMethod,
  concrete_consistency?: ConcreteConsistency,
): FormworkFilterResult & { pour_method: PourMethod; pressure_formula: string } {
  const profile = ELEMENT_CATALOG[type];
  const method = pour_method ?? inferPourMethod(profile.pump_typical, height_m);
  const consistency: ConcreteConsistency = concrete_consistency ?? 'standard';
  const pressure = calculateLateralPressure(height_m, method, { concrete_consistency: consistency });
  const { all: compatibleSystems } = getSuitableSystemsForElement(type);
  const filtered = filterFormworkByPressure(
    pressure.pressure_kn_m2,
    compatibleSystems,
    profile.orientation,
    height_m,
  );
  return {
    ...filtered,
    pour_method: method,
    pressure_formula: pressure.formula,
  };
}

/**
 * Get adjusted assembly norm for element + formwork system combination.
 *
 * adjusted_norm = base_norm × difficulty_factor
 */
export function getAdjustedAssemblyNorm(
  elementType: StructuralElementType,
  formworkSystem: FormworkSystemSpec
): { assembly_h_m2: number; disassembly_h_m2: number; difficulty_factor: number } {
  const profile = ELEMENT_CATALOG[elementType];
  const df = profile.difficulty_factor;
  return {
    assembly_h_m2: roundTo(formworkSystem.assembly_h_m2 * df, 3),
    disassembly_h_m2: roundTo(formworkSystem.disassembly_h_m2 * df, 3),
    difficulty_factor: df,
  };
}

/**
 * Estimate rebar mass from element type and concrete volume.
 * Uses typical reinforcement ratios per element type.
 */
/**
 * Element-to-category mapping: which formwork categories are suitable for each orientation.
 * Wall systems fit vertical elements, slab systems fit horizontal, etc.
 */
const ELEMENT_SUITABLE_CATEGORIES: Record<string, Set<string>> = {
  vertical: new Set(['wall', 'universal']),
  horizontal: new Set(['slab', 'universal']),
};

/**
 * Get formwork systems suitable for a given element type.
 * Combines: (1) explicitly recommended systems + (2) all systems of compatible category.
 * Returns { recommended, compatible, all } with deduplication.
 */
export function getSuitableSystemsForElement(elementType: StructuralElementType): {
  recommended: FormworkSystemSpec[];
  compatible: FormworkSystemSpec[];
  all: FormworkSystemSpec[];
} {
  const profile = ELEMENT_CATALOG[elementType];

  // A7 (2026-04-15): special case for římsa.
  //
  // Římsa is the only horizontal element whose recommended systems are
  // unit='bm' (linear-meter) and category='special' — Římsové bednění T,
  // Římsový vozík TU/T. The generic loop below skips both (line "if unit==='bm' continue"
  // and the orientation→category map only allows {'slab','universal'}), so
  // calling getSuitableSystemsForElement('rimsa') used to return slab/universal
  // systems (Dokaflex, MULTIFLEX, Top 50…) which are completely wrong for
  // římsa. The comparison table in PlannerPage was therefore showing
  // stropní systems for römsa.
  //
  // Fix: short-circuit rimsa to only its recommended_formwork list,
  // looked up directly in FORMWORK_SYSTEMS by name.
  if (elementType === 'rimsa') {
    const rimsaNames = new Set(profile.recommended_formwork);
    const rimsaSystems = FORMWORK_SYSTEMS.filter(s => rimsaNames.has(s.name));
    return {
      recommended: rimsaSystems,
      compatible: [],
      all: rimsaSystems,
    };
  }

  const orientation = profile.orientation;
  const suitableCategories = ELEMENT_SUITABLE_CATEGORIES[orientation] ?? new Set(['wall', 'universal']);

  // Column elements also accept column-category systems
  if (['sloup', 'driky_piliru'].includes(elementType)) {
    suitableCategories.add('column');
  }
  // Tanks/basins accept special (RUNDFLEX)
  if (elementType === 'nadrz') {
    suitableCategories.add('special');
  }

  const recommendedNames = new Set(profile.recommended_formwork);

  const recommended: FormworkSystemSpec[] = [];
  const compatible: FormworkSystemSpec[] = [];

  for (const sys of FORMWORK_SYSTEMS) {
    if (sys.unit === 'bm') continue; // skip linear-meter systems
    const cat = sys.formwork_category ?? 'wall';
    if (cat === 'support_tower') continue; // support towers handled by props calculator, not formwork comparison
    // Terminology Commit 2 (2026-04-17): MSS entries (mss_integrated)
    // are dispatched up front by the orchestrator when the user chose
    // construction_technology='mss'. They must never leak into the
    // normal candidate pool — their Nhod represent the full MSS mount
    // which only pays off across many tacts.
    if (sys.pour_role === 'mss_integrated') continue;
    // Terminology Commit 2: honour applicable_element_types allow-list.
    // Before this, Dokaflex/MULTIFLEX/SKYDECK/CC-4 slipped into the
    // mostovka candidate pool because their formwork_category='slab'
    // matched horizontal allow-list, and the UI proposed Dokaflex for
    // bridge decks — structurally wrong (max reach ~5 m, building slab
    // system).
    if (sys.applicable_element_types && !sys.applicable_element_types.includes(elementType)) {
      continue;
    }
    const isSuitable = suitableCategories.has(cat);
    const isRecommended = recommendedNames.has(sys.name);

    if (isRecommended && isSuitable) {
      recommended.push(sys);
    } else if (isSuitable) {
      compatible.push(sys);
    }
  }

  return {
    recommended,
    compatible,
    all: [...recommended, ...compatible],
  };
}

// ─── HINT-1 + HINT-2: Required fields + sanity ranges ─────────────────────

/**
 * Severity for a missing / out-of-range hint
 *   'critical' → engine cannot produce meaningful output
 *   'optional' → engine has fallback, but user gets less precise result
 */
export type HintSeverity = 'critical' | 'optional';

export interface RequiredFieldSpec {
  field: string;
  label_cs: string;
  severity: HintSeverity;
  reason_cs: string;
}

/**
 * Minimum inputs the planner needs to compute a useful result.
 * Shared between wizard hints (HINT-1) and validation.
 */
export const REQUIRED_FIELDS: Record<StructuralElementType, RequiredFieldSpec[]> = {
  zaklady_piliru: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry a náklady' },
    { field: 'height_m', label_cs: 'Výška základu', severity: 'optional', reason_cs: 'ovlivňuje boční tlak a volbu bednění' },
  ],
  // Phase 3 Gate 2a: zaklady_oper required-fields parallel zaklady_piliru
  zaklady_oper: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry a náklady' },
    { field: 'height_m', label_cs: 'Výška základu', severity: 'optional', reason_cs: 'ovlivňuje boční tlak a volbu bednění' },
  ],
  driky_piliru: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška pilíře', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak a záběry' },
    { field: 'formwork_area_m2', label_cs: 'Plocha bednění', severity: 'optional', reason_cs: 'prázdné = dopočítám z objemu a výšky' },
  ],
  rimsa: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'total_length_m', label_cs: 'Délka mostu', severity: 'optional', reason_cs: 'určuje systém (konzoly vs. vozík)' },
  ],
  operne_zdi: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška zdi', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
    { field: 'total_length_m', label_cs: 'Délka zdi', severity: 'optional', reason_cs: 'ovlivňuje sekce a šachovnici' },
  ],
  mostovkova_deska: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat náklady' },
    // Task 3 (2026-04): height_m is REQUIRED for needs_supports=true elements.
    // calculateProps in the orchestrator gates on input.height_m, so without
    // it the entire skruž / stojky pricing pipeline is skipped silently.
    { field: 'height_m', label_cs: 'Výška nad terénem', severity: 'critical', reason_cs: 'nutná pro výpočet podpěr/skruže (stropní bednění visí na stojkách)' },
    { field: 'formwork_area_m2', label_cs: 'Plocha bednění', severity: 'optional', reason_cs: 'prázdné = dopočítám z objemu' },
    { field: 'span_m', label_cs: 'Rozpětí', severity: 'optional', reason_cs: 'rozhoduje o technologii (MSS/CFT)' },
    { field: 'num_spans', label_cs: 'Počet polí', severity: 'optional', reason_cs: 'pro MSS harmonogram' },
  ],
  rigel: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška pod příčníkem', severity: 'critical', reason_cs: 'nutné pro podpěrnou konstrukci' },
  ],
  opery_ulozne_prahy: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška opěry', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
  ],
  kridla_opery: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška křídla', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
  ],
  mostni_zavirne_zidky: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
  ],
  prechodova_deska: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
  ],
  zakladova_deska: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'formwork_area_m2', label_cs: 'Plocha desky', severity: 'optional', reason_cs: 'pro podpěry a pronájem bednění' },
  ],
  zakladovy_pas: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'total_length_m', label_cs: 'Délka pásu', severity: 'optional', reason_cs: 'pro sekcování' },
  ],
  zakladova_patka: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
  ],
  stropni_deska: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'formwork_area_m2', label_cs: 'Plocha stropu', severity: 'optional', reason_cs: 'prázdné = dopočítám z objemu' },
    { field: 'height_m', label_cs: 'Světlá výška', severity: 'critical', reason_cs: 'pro výpočet stojek a skruže' },
  ],
  stena: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška stěny', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak a záběry' },
  ],
  sloup: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška sloupu', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
  ],
  pruvlak: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Světlá výška', severity: 'critical', reason_cs: 'pro skruž a stojky' },
  ],
  schodiste: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška podlaží', severity: 'critical', reason_cs: 'pro skruž' },
  ],
  nadrz: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
    { field: 'height_m', label_cs: 'Výška stěn', severity: 'critical', reason_cs: 'bez výšky nelze spočítat boční tlak' },
  ],
  podzemni_stena: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat panely' },
  ],
  pilota: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat záběry' },
  ],
  podkladni_beton: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat náklady' },
  ],
  podlozkovy_blok: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat náklady' },
    { field: 'height_m', label_cs: 'Výška bloku', severity: 'optional', reason_cs: 'ovlivňuje bednění (typicky 0.3–0.5 m)' },
  ],
  other: [
    { field: 'volume_m3', label_cs: 'Objem betonu', severity: 'critical', reason_cs: 'bez objemu nelze počítat náklady' },
  ],
};

/**
 * Typical min/max ranges per element type — used for sanity checks in the
 * wizard (HINT-2). Values outside these bounds should trigger a warning
 * but NOT block the user.
 */
export interface SanityRanges {
  volume_m3?: [number, number];
  height_m?: [number, number];
  rebar_kg_m3?: [number, number];
  formwork_area_m2?: [number, number];
  /**
   * Mostovka A1 (2026-04-16): deck cross-section thickness (m). Separate from
   * height_m, which for mostovkova_deska is the prop height (ground → underside).
   * Using two distinct ranges stops the old heuristic from flagging a 6 m tall
   * support scaffold as "neobvykle velká" (it was checked against the
   * 0.3–2.5 deck-thickness range).
   */
  deck_thickness_m?: [number, number];
}

// A6 (2026-04-15): widened ranges to fit real bridge + foundation jobs.
//
//   • rimsa: 2–200 → 0.5–500 m³ (FORESTINA estakáda 300 m × 2 římsy × 0.4 m² = 240+ m³
//     used to trigger a false "mimo rozsah" warning).
//   • pilota: 1–200 → 0.5–600 m³ (large bridge piles 1.5 m Ø × 30 m × pilier sets reach 400+ m³).
//   • driky_piliru: 5–400 → 1–800 m³ (tall bridge piers in groups exceed 400 m³).
//   • mostni_zavirne_zidky: 1–20 → 0.3–40 m³ (long mostní závěrné zídky on viaducts).
//
// The remaining ranges were spot-checked against typical Czech bridge and
// pozemní stavby BOQs and kept as-is.
export const SANITY_RANGES: Record<StructuralElementType, SanityRanges> = {
  zaklady_piliru:   { volume_m3: [10, 800],  height_m: [0.8, 3.0],  rebar_kg_m3: [60, 150] },
  zaklady_oper:     { volume_m3: [10, 800],  height_m: [0.8, 3.0],  rebar_kg_m3: [60, 150] }, // Phase 3 Gate 2a — same ranges as zaklady_piliru
  driky_piliru:     { volume_m3: [1, 800],   height_m: [3.0, 30.0], rebar_kg_m3: [80, 220] },
  rimsa:            { volume_m3: [0.5, 500], height_m: [0.3, 0.8],  rebar_kg_m3: [80, 180] },
  operne_zdi:       { volume_m3: [10, 500],  height_m: [2.0, 12.0], rebar_kg_m3: [50, 130] },
  // Mostovka A1 (2026-04-16): height_m = podpěrné lešení od terénu po spodek
  // desky (prop height), typ. 4–20 m. deck_thickness_m = průřez desky (0.3–2.5 m).
  // Před tímto splitem byl height_m checkován proti 0.3–2.5 a každý reálný
  // most (6–15 m nad terénem) triggeroval "neobvykle velká hodnota" warning.
  mostovkova_deska: { volume_m3: [20, 2000], height_m: [4, 20], deck_thickness_m: [0.3, 2.5], rebar_kg_m3: [100, 200] },
  rigel:            { volume_m3: [3, 150],   height_m: [0.6, 3.0],  rebar_kg_m3: [100, 200] },
  opery_ulozne_prahy:{ volume_m3: [10, 500], height_m: [2.0, 15.0], rebar_kg_m3: [70, 160] },
  kridla_opery:     { volume_m3: [5, 200],   height_m: [2.0, 10.0], rebar_kg_m3: [60, 140] },
  mostni_zavirne_zidky:{ volume_m3: [0.3, 40], height_m: [0.5, 2.0], rebar_kg_m3: [50, 120] },
  prechodova_deska: { volume_m3: [5, 80],    height_m: [0.2, 0.5],  rebar_kg_m3: [70, 140] },
  zakladova_deska:  { volume_m3: [10, 2000], height_m: [0.3, 2.0],  rebar_kg_m3: [80, 160] },
  zakladovy_pas:    { volume_m3: [5, 500],   height_m: [0.4, 1.5],  rebar_kg_m3: [50, 120] },
  zakladova_patka:  { volume_m3: [2, 50],    height_m: [0.5, 2.0],  rebar_kg_m3: [60, 140] },
  stropni_deska:    { volume_m3: [5, 1000],  height_m: [0.12, 0.40],rebar_kg_m3: [60, 150] },
  stena:            { volume_m3: [5, 500],   height_m: [2.5, 12.0], rebar_kg_m3: [50, 130] },
  sloup:            { volume_m3: [1, 80],    height_m: [2.5, 20.0], rebar_kg_m3: [120, 240] },
  pruvlak:          { volume_m3: [1, 60],    height_m: [0.4, 2.0],  rebar_kg_m3: [100, 200] },
  schodiste:        { volume_m3: [1, 30],    height_m: [2.5, 5.0],  rebar_kg_m3: [100, 180] },
  nadrz:            { volume_m3: [10, 800],  height_m: [2.0, 8.0],  rebar_kg_m3: [70, 160] },
  podzemni_stena:   { volume_m3: [20, 2000], height_m: [5.0, 40.0], rebar_kg_m3: [50, 140] },
  pilota:           { volume_m3: [0.5, 600], height_m: [5.0, 40.0], rebar_kg_m3: [40, 120] },
  podkladni_beton:  { volume_m3: [0.5, 200] },
  podlozkovy_blok:  { volume_m3: [0.1, 5],   height_m: [0.2, 0.6],  rebar_kg_m3: [150, 250] },
  other:            { volume_m3: [0.5, 5000] },
};

export interface SanityIssue {
  field: keyof SanityRanges;
  value: number;
  min: number;
  max: number;
  label_cs: string;
  message_cs: string;
}

/**
 * Check a set of user-provided numeric inputs against SANITY_RANGES and
 * return any that are out of the typical range (possibly a typo).
 */
export function checkSanity(
  elementType: StructuralElementType,
  values: Partial<Record<keyof SanityRanges, number>>,
): SanityIssue[] {
  const ranges = SANITY_RANGES[elementType];
  if (!ranges) return [];
  const issues: SanityIssue[] = [];
  const labels: Record<keyof SanityRanges, string> = {
    volume_m3: 'Objem',
    height_m: elementType === 'mostovkova_deska' ? 'Výška nad terénem' : 'Výška',
    rebar_kg_m3: 'Výztuž',
    formwork_area_m2: 'Plocha bednění',
    deck_thickness_m: 'Tloušťka desky',
  };
  for (const key of Object.keys(ranges) as (keyof SanityRanges)[]) {
    const range = ranges[key];
    if (!range) continue;
    const value = values[key];
    if (value == null || !Number.isFinite(value)) continue;
    const [min, max] = range;
    if (value < min || value > max) {
      // A6 (2026-04-15): soft warning text — the previous "mimo typický
      // rozsah" wording sounded like a hard error, even though the wizard
      // never blocks the user. The new wording asks to verify, with the
      // direction (větší / menší) explicit.
      const direction = value > max ? 'Neobvykle velká hodnota' : 'Neobvykle malá hodnota';
      issues.push({
        field: key,
        value,
        min, max,
        label_cs: labels[key],
        message_cs: `${direction} pro ${ELEMENT_CATALOG[elementType].label_cs}: ${labels[key]} ${value}. Ověřte zadání (typický rozsah ${min}–${max}).`,
      });
    }
  }
  return issues;
}

export function estimateRebarMass(
  elementType: StructuralElementType,
  volume_m3: number
): { estimated_kg: number; min_kg: number; max_kg: number; ratio_kg_m3: number } {
  const profile = ELEMENT_CATALOG[elementType];
  return {
    estimated_kg: roundTo(volume_m3 * profile.rebar_ratio_kg_m3, 1),
    min_kg: roundTo(volume_m3 * profile.rebar_ratio_range[0], 1),
    max_kg: roundTo(volume_m3 * profile.rebar_ratio_range[1], 1),
    ratio_kg_m3: profile.rebar_ratio_kg_m3,
  };
}

/**
 * Volume-vs-geometry validation (2026-04-17).
 *
 * Catches the "zadal jsem objem jednoho pole místo celé NK" class of
 * mistakes — the live SO-207 test had V=605 m³ entered for a 9-span
 * 310 m × 13 m estakáda where the real total is ~4 000 m³. SanityRanges
 * alone couldn't catch it (605 m³ is inside the 20–2000 m³ mostovka
 * range); we need to compare against the geometry the user already
 * provided (span × num_spans × width × thickness equivalent).
 *
 * Ratio = actual / expected:
 *   < 0.3  → CRITICAL ("objem je 3× menší, nevkládáš pole místo NK?")
 *   0.3-0.7 → WARNING  ("menší než typický, zkontroluj")
 *   0.7-1.5 → OK
 *   1.5-3   → WARNING  ("větší než typický")
 *   > 3     → CRITICAL ("3× větší, zkontroluj")
 *
 * Currently covers mostovkova_deska (span × num_spans × nk_width ×
 * subtype-equivalent thickness) and pilota (π × (Ø/2)² × length ×
 * count). Returns null when geometry isn't provided or element type
 * has no formula (the validator gracefully skips).
 */
export type GeometryIssueSeverity = 'critical' | 'warning';

export interface GeometryIssue {
  severity: GeometryIssueSeverity;
  actual_m3: number;
  expected_m3: number;
  ratio: number;
  message_cs: string;
}

/** Equivalent thickness (m) for bridge-deck subtypes — used by
 *  estimateExpectedVolume to cross-check mostovka volumes. Values
 *  reflect the typical cross-section area divided by deck width so
 *  that V = span × num_spans × nk_width × thickness_eq is a
 *  reasonable 1st-order estimate. Sources: ČSN 73 6220 design
 *  examples + CZ practice for D6 SO-series. */
const DECK_SUBTYPE_EQ_THICKNESS_M: Record<string, number> = {
  deskovy: 0.5,
  jednotram: 1.0,
  dvoutram: 1.0,
  vicetram: 1.0,
  jednokomora: 0.7,
  dvoukomora: 0.7,
  ramovy: 0.8,
  sprazeny: 0.25,
};

export function estimateExpectedVolume(
  elementType: StructuralElementType,
  input: {
    span_m?: number;
    num_spans?: number;
    nk_width_m?: number;
    bridge_deck_subtype?: string;
    pile_diameter_mm?: number;
    pile_length_m?: number;
    pile_count?: number;
  },
): number | null {
  if (elementType === 'mostovkova_deska') {
    if (!input.span_m || !input.num_spans || !input.nk_width_m) return null;
    const thick = DECK_SUBTYPE_EQ_THICKNESS_M[input.bridge_deck_subtype ?? 'deskovy'] ?? 0.5;
    return input.span_m * input.num_spans * input.nk_width_m * thick;
  }
  if (elementType === 'pilota') {
    if (!input.pile_diameter_mm || !input.pile_length_m || !input.pile_count) return null;
    const r = (input.pile_diameter_mm / 1000) / 2;
    return Math.PI * r * r * input.pile_length_m * input.pile_count;
  }
  return null;
}

export function checkVolumeGeometry(
  elementType: StructuralElementType,
  actual_m3: number,
  geometry: {
    span_m?: number;
    num_spans?: number;
    nk_width_m?: number;
    bridge_deck_subtype?: string;
    pile_diameter_mm?: number;
    pile_length_m?: number;
    pile_count?: number;
  },
): GeometryIssue | null {
  const expected = estimateExpectedVolume(elementType, geometry);
  if (expected == null || expected <= 0 || actual_m3 <= 0) return null;
  const ratio = actual_m3 / expected;
  if (ratio >= 0.7 && ratio <= 1.5) return null;
  const label = ELEMENT_CATALOG[elementType].label_cs;
  const expectedRounded = Math.round(expected * 10) / 10;
  let severity: GeometryIssueSeverity;
  let message_cs: string;
  if (ratio < 0.3) {
    severity = 'critical';
    const tooMany = elementType === 'mostovkova_deska' ? '— nevkládáš objem jednoho pole místo celé NK?' : '';
    message_cs = `⛔ KRITICKÉ: Objem ${actual_m3} m³ je ${(expected / actual_m3).toFixed(1)}× menší než očekávaný ${expectedRounded} m³ pro ${label} (z geometrie) ${tooMany}`.trim();
  } else if (ratio < 0.7) {
    severity = 'warning';
    message_cs = `⚠️ Objem ${actual_m3} m³ je menší než typický pro ${label} (očekáváno ~${expectedRounded} m³ z geometrie). Zkontrolujte zadání.`;
  } else if (ratio <= 3) {
    severity = 'warning';
    message_cs = `⚠️ Objem ${actual_m3} m³ je větší než typický pro ${label} (očekáváno ~${expectedRounded} m³ z geometrie). Zkontrolujte zadání.`;
  } else {
    severity = 'critical';
    message_cs = `⛔ KRITICKÉ: Objem ${actual_m3} m³ je ${ratio.toFixed(1)}× větší než očekávaný ${expectedRounded} m³ pro ${label} (z geometrie).`;
  }
  return {
    severity,
    actual_m3,
    expected_m3: expectedRounded,
    ratio: Math.round(ratio * 100) / 100,
    message_cs,
  };
}

/**
 * Get all element types with their Czech labels.
 */
export function getAllElementTypes(): Array<{ type: StructuralElementType; label_cs: string }> {
  return (Object.entries(ELEMENT_CATALOG) as [StructuralElementType, typeof ELEMENT_CATALOG[StructuralElementType]][]).map(
    ([type, profile]) => ({ type, label_cs: profile.label_cs })
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Rebar labor-rate matrix (BUG A fix, v4.24, 2026-04-20) ──────────────────

/**
 * Rebar labor norm (h/t) by category × bar diameter (mm).
 *
 * Source: methvin.co production rates (April 2026 update), cross-validated
 * against RSMeans labor-hour norms and IJERT academic measurements for
 * precast-fly-over-bridge construction. "Average speed" column.
 *   https://methvin.co/production-rates/concrete-work/reinforcement-steel/
 *
 * Context:
 *   Old engine used a blanket per-element rate (e.g. 45 h/t for opěrné zdi)
 *   which matches stirrup-rate, not main-bar rate. Real productivity for
 *   D12mm main bars in walls is 17.3 h/t — ~3× faster. See BUG A audit
 *   (REBAR_NORMS_AUDIT.md, 2026-04-20).
 *
 * Fallback: if a (category, diameter) pair is missing, engine falls back to
 * `ElementProfile.rebar_norm_h_per_t` (legacy). See `getRebarNormForDiameter`.
 *
 * All rates are per tradesman, NOT per crew (Methvin convention). Czech
 * practice of 4–8 železářů per crew maps 1:1.
 */
export const REBAR_RATES_MATRIX: Record<RebarCategory, Record<number, number>> = {
  slabs_foundations: {
    6: 38.4, 8: 26.9, 10: 20.6, 12: 16.3, 14: 14.0, 16: 11.5,
    20: 8.6, 25: 6.7, 32: 5.5, 40: 5.1, 50: 4.9,
  },
  walls: {
    6: 40.8, 8: 28.6, 10: 22.0, 12: 17.3, 14: 14.8, 16: 12.2,
    20: 9.2, 25: 7.2, 32: 6.8, 40: 6.1, 50: 5.1,
  },
  beams_columns: {
    6: 52.8, 8: 37.0, 10: 28.4, 12: 22.4, 14: 19.1, 16: 15.8,
    20: 11.9, 25: 9.2, 32: 6.6, 40: 5.9, 50: 5.9,
  },
  staircases: {
    6: 48.0, 8: 33.6, 10: 25.8, 12: 20.4, 14: 17.4, 16: 14.4,
    20: 10.8, 25: 8.4,
  },
};

export interface RebarNormLookup {
  /** Final h/t rate used */
  norm_h_per_t: number;
  /** 'matrix' = looked up in REBAR_RATES_MATRIX, 'legacy' = fell back to profile.rebar_norm_h_per_t */
  source: 'matrix' | 'legacy';
  /** Category used for lookup (undefined on legacy fallback) */
  category?: RebarCategory;
  /** Diameter used for lookup (user-provided or element default) */
  used_diameter_mm?: number;
}

/**
 * Resolve rebar labor norm (h/t) for an element + optional user-provided
 * diameter. Falls back to the element's legacy per-element rate when the
 * (category, diameter) pair is missing in the matrix.
 *
 * Usage:
 *   // User specified diameter:
 *   getRebarNormForDiameter('operne_zdi', 12)
 *   // → { norm_h_per_t: 17.3, source: 'matrix', category: 'walls', used_diameter_mm: 12 }
 *
 *   // No diameter → element default (D12 for walls):
 *   getRebarNormForDiameter('operne_zdi')
 *   // → { norm_h_per_t: 17.3, source: 'matrix', category: 'walls', used_diameter_mm: 12 }
 */
export function getRebarNormForDiameter(
  element_type: StructuralElementType,
  diameter_mm?: number,
): RebarNormLookup {
  const profile = getElementProfile(element_type);
  // Pile armokoš is prefabricated in "armovna" (shop) + transported + lowered
  // into the bore — entirely different workflow from in-situ rebar tying.
  // Methvin rates don't cover this case, so pile always falls back to the
  // legacy per-element rate (30 h/t via pile-engine tuning).
  if (element_type === 'pilota') {
    return { norm_h_per_t: profile.rebar_norm_h_per_t, source: 'legacy' };
  }
  const category = profile.rebar_category;
  const d = diameter_mm ?? profile.rebar_default_diameter_mm;
  const matrix = REBAR_RATES_MATRIX[category];
  const rate = matrix ? matrix[d] : undefined;
  if (rate !== undefined) {
    return { norm_h_per_t: rate, source: 'matrix', category, used_diameter_mm: d };
  }
  // Unusual diameter (e.g. D18 not in matrix) → legacy per-element rate
  return { norm_h_per_t: profile.rebar_norm_h_per_t, source: 'legacy' };
}

// ─── TZ parameter compatibility per element type (Task 1, 2026-04-20) ────────

/**
 * Known TZ-parameter field names emitted by `tz-text-extractor.ts`
 * (includes smeta-line derived fields). Used to type the compatibility
 * map — extractor can emit other names too, which default to "universal".
 */
export type TzParamName =
  | 'element_type'
  | 'concrete_class'
  | 'exposure_class'
  | 'volume_m3'
  | 'height_m'
  | 'thickness_mm'
  | 'formwork_area_m2'
  | 'reinforcement_total_kg'
  | 'reinforcement_ratio_kg_m3'
  | 'span_m'
  | 'num_spans'
  | 'nk_width_m'
  | 'total_length_m'
  | 'bridge_deck_subtype'
  | 'is_prestressed'
  | 'prestress_tensioning'
  | 'prestress_cables_count'
  | 'prestress_strands_per_cable'
  | 'pile_diameter_mm'
  // Task 2 (2026-04-20): array-form exposure classes (ČSN EN 206+A2).
  | 'exposure_classes';

/**
 * Parameters that are meaningful for ANY structural element — always
 * compatible. Represents the minimum fill every element accepts from TZ.
 */
const UNIVERSAL_TZ_PARAMS: readonly TzParamName[] = [
  'concrete_class',
  'exposure_class',
  // Task 2 (2026-04-20): multi-class selection is universal for every
  // element type (same rationale as the singular).
  'exposure_classes',
  'volume_m3',
  'formwork_area_m2',
  'reinforcement_total_kg',
  'reinforcement_ratio_kg_m3',
];

/** Bridge-deck / beam specific params (mostovky, rigely, komory). */
const BRIDGE_DECK_TZ_PARAMS: readonly TzParamName[] = [
  'span_m',
  'num_spans',
  'nk_width_m',
  'total_length_m',
  'bridge_deck_subtype',
  'is_prestressed',
  'prestress_tensioning',
  'prestress_cables_count',
  'prestress_strands_per_cable',
  'thickness_mm',
];

/**
 * Per-element TZ-compatibility map — which TZ params are meaningful for each
 * structural element type. Used by `TzTextInput.applyParams` to filter out
 * parameters extracted from the TZ of the whole object that don't apply to
 * the specific element the user is calculating (e.g. "rozpětí 32 m" when
 * user is computing základy).
 *
 * Includes UNIVERSAL_TZ_PARAMS implicitly (via `isParamCompatibleWith`).
 * This array only lists ADDITIONAL element-specific params.
 *
 * Note: `element_type` is intentionally excluded from all entries. When
 * user opens calculator from Monolit Planner, the element type is locked
 * from parent context — Smart Extractor must never overwrite it. In
 * standalone (Scenario B) the caller bypasses this filter.
 */
export const ELEMENT_TZ_COMPATIBILITY: Record<
  StructuralElementType,
  readonly TzParamName[]
> = {
  // ── Foundations (horizontal, no bridge-deck params) ──────────────────────
  zaklady_piliru: ['height_m', 'thickness_mm'],
  zaklady_oper:   ['height_m', 'thickness_mm'], // Phase 3 Gate 2a — same TZ params as zaklady_piliru
  zakladova_deska: ['height_m', 'thickness_mm'],
  zakladovy_pas: ['height_m', 'thickness_mm'],
  zakladova_patka: ['height_m', 'thickness_mm'],
  prechodova_deska: ['height_m', 'thickness_mm', 'total_length_m'],

  // ── Retaining walls / abutments (vertical, length-relevant) ──────────────
  operne_zdi: ['height_m', 'total_length_m', 'thickness_mm'],
  kridla_opery: ['height_m', 'total_length_m', 'thickness_mm'],
  opery_ulozne_prahy: ['height_m', 'total_length_m', 'thickness_mm'],
  mostni_zavirne_zidky: ['height_m', 'total_length_m', 'thickness_mm'],
  stena: ['height_m', 'total_length_m', 'thickness_mm'],
  podzemni_stena: ['height_m', 'total_length_m', 'thickness_mm'],
  nadrz: ['height_m', 'total_length_m', 'thickness_mm'],

  // ── Piers / columns / beams (vertical or beam, height-relevant) ──────────
  driky_piliru: ['height_m', 'thickness_mm'],
  sloup: ['height_m', 'thickness_mm'],
  pruvlak: ['height_m', 'total_length_m', 'thickness_mm'],

  // ── Bridge deck / rigels (full bridge geometry relevant) ─────────────────
  mostovkova_deska: [...BRIDGE_DECK_TZ_PARAMS],
  rigel: [...BRIDGE_DECK_TZ_PARAMS],

  // ── Slab-like ceilings ───────────────────────────────────────────────────
  stropni_deska: ['height_m', 'thickness_mm', 'total_length_m'],

  // ── Stairs / edge beams ──────────────────────────────────────────────────
  schodiste: ['height_m', 'thickness_mm'],
  rimsa: ['height_m', 'total_length_m', 'thickness_mm'],

  // ── Piles (own diameter, no formwork) ────────────────────────────────────
  pilota: ['pile_diameter_mm', 'height_m'],

  // ── Small plain concrete (minimal geometry) ──────────────────────────────
  podkladni_beton: ['thickness_mm'],
  podlozkovy_blok: ['thickness_mm'],

  // ── Fallback: accept everything (universal only) ─────────────────────────
  other: [...BRIDGE_DECK_TZ_PARAMS, 'pile_diameter_mm', 'height_m', 'thickness_mm'],
};

/**
 * Check whether a TZ parameter is compatible with (meaningful for) a
 * structural element type. Returns `true` for universal params regardless
 * of element type, plus any element-specific params from
 * `ELEMENT_TZ_COMPATIBILITY`. Unknown param names default to `true`
 * (conservative — better to apply a legit value than silently drop one).
 *
 * Does NOT handle lock state — the caller is responsible for filtering
 * locked fields separately (element_type, volume_m3, position code when
 * calculator is opened from Monolit Planner).
 */
export function isParamCompatibleWith(
  param_name: string,
  element_type: StructuralElementType,
): boolean {
  // Universal params — always compatible
  if ((UNIVERSAL_TZ_PARAMS as readonly string[]).includes(param_name)) return true;
  // Element-specific list
  const specific = ELEMENT_TZ_COMPATIBILITY[element_type];
  if (specific && (specific as readonly string[]).includes(param_name)) return true;
  // Unknown param (not in our typed list) — default to allow for forward
  // compatibility (new extractor features won't be silently dropped).
  const allKnown = new Set<string>([
    ...UNIVERSAL_TZ_PARAMS,
    ...BRIDGE_DECK_TZ_PARAMS,
    'pile_diameter_mm',
    'height_m',
    'thickness_mm',
    'element_type',
  ]);
  return !allKnown.has(param_name);
}

/**
 * Human-readable reason why a param is NOT compatible with element_type.
 * Used in UI "ignored params" expandable list. Returns `null` when the
 * param IS compatible (caller should check compat first).
 */
export function explainIncompatibility(
  param_name: string,
  element_type: StructuralElementType,
): string | null {
  if (isParamCompatibleWith(param_name, element_type)) return null;
  const label = getElementProfile(element_type).label_cs;
  const bridgeOnly: readonly string[] = BRIDGE_DECK_TZ_PARAMS;
  if (bridgeOnly.includes(param_name)) {
    return `Parametr mostní nosné konstrukce — nepoužije se pro „${label}".`;
  }
  if (param_name === 'pile_diameter_mm') {
    return `Průměr piloty — nepoužije se pro „${label}".`;
  }
  return `Parametr není relevantní pro „${label}".`;
}
