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

  // --- Rebar ---
  /** Typical reinforcement ratio kg/m³ (midpoint) */
  rebar_ratio_kg_m3: number;
  /** Min–max rebar ratio range */
  rebar_ratio_range: [number, number];
  /** Rebar labor norm (h/t) — element-specific */
  rebar_norm_h_per_t: number;

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
}

// ─── Element Catalog ─────────────────────────────────────────────────────────

const ELEMENT_CATALOG: Record<StructuralElementType, Omit<ElementProfile, 'element_type' | 'confidence'>> = {
  zaklady_piliru: {
    label_cs: 'Základy pilířů / patky',
    recommended_formwork: ['Frami Xlife', 'Tradiční tesařské'],
    difficulty_factor: 0.9,
    needs_supports: false,
    needs_platforms: false,
    needs_crane: false,
    rebar_ratio_kg_m3: 100,
    rebar_ratio_range: [80, 120],
    rebar_norm_h_per_t: 40,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 40,
    pump_typical: true,
  },
  driky_piliru: {
    label_cs: 'Dříky pilířů / sloupy',
    recommended_formwork: ['SL-1 Sloupové', 'Framax Xlife'],
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
    label_cs: 'Římsová deska',
    recommended_formwork: ['Římsové bednění T', 'Tradiční tesařské'],
    difficulty_factor: 1.15,
    needs_supports: true,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 120,
    rebar_ratio_range: [100, 150],
    rebar_norm_h_per_t: 50,
    strip_strength_pct: 70,
    orientation: 'horizontal',
    max_pour_rate_m3_h: 20,
    pump_typical: true,
  },
  operne_zdi: {
    label_cs: 'Opěrné zdi',
    recommended_formwork: ['Framax Xlife', 'Frami Xlife', 'TRIO'],
    difficulty_factor: 1.0,
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
    recommended_formwork: ['Top 50', 'Dokaflex'],
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
    label_cs: 'Příčník / ригель',
    recommended_formwork: ['Framax Xlife', 'Tradiční tesařské'],
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
    recommended_formwork: ['Framax Xlife', 'Frami Xlife'],
    difficulty_factor: 1.0,
    needs_supports: false,
    needs_platforms: true,
    needs_crane: true,
    rebar_ratio_kg_m3: 100,
    rebar_ratio_range: [80, 130],
    rebar_norm_h_per_t: 45,
    strip_strength_pct: 50,
    orientation: 'vertical',
    max_pour_rate_m3_h: 35,
    pump_typical: true,
  },
  mostni_zavirne_zidky: {
    label_cs: 'Mostní závěrné zídky',
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
  other: {
    label_cs: 'Jiný monolitický prvek',
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

// ─── Keyword-based classification ────────────────────────────────────────────

interface KeywordRule {
  element_type: StructuralElementType;
  keywords: string[];
  /** Higher priority wins when multiple rules match */
  priority: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    element_type: 'mostovkova_deska',
    keywords: [
      'mostovka', 'mostovkov', 'mostova deska', 'mostní deska', 'mostni deska',
      'deska mostu', 'nosna konstrukce', 'nosná konstrukce', 'bridge deck',
      'мостов', 'мостовая плита', 'пролетное строение',
    ],
    priority: 10,
  },
  { element_type: 'rimsa', keywords: ['rimsa', 'říms', 'rimsov'], priority: 10 },
  { element_type: 'mostni_zavirne_zidky', keywords: ['zavirn', 'závěrn', 'zidka', 'zídka'], priority: 9 },
  { element_type: 'rigel', keywords: ['pricnik', 'příčník', 'pricni', 'příčn', 'rigel'], priority: 9 },
  { element_type: 'zaklady_piliru', keywords: ['zaklad', 'základ', 'patka', 'pas ', 'pás ', 'zakladov', 'základov', 'plošin'], priority: 8 },
  { element_type: 'driky_piliru', keywords: ['drik', 'dřík', 'sloup'], priority: 7 },
  { element_type: 'operne_zdi', keywords: ['opern', 'opěrn', 'zed', 'zeď', 'stena', 'stěna', 'kridl', 'křídl', 'подпорн'], priority: 7 },
  { element_type: 'opery_ulozne_prahy', keywords: ['opera', 'opěra', 'ulozn', 'úložn', 'prah', 'sedlo'], priority: 7 },
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

/**
 * Classify a construction element by name/description.
 *
 * @param name - Part name or description (Czech), e.g. "ZÁKLADY PILÍŘŮ", "Mostovková deska"
 * @returns ElementProfile with all defaults and recommendations
 */
export function classifyElement(name: string): ElementProfile {
  const normalized = normalize(name);

  // Score each rule
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
    if (matchCount > 0) {
      const score = matchCount * 10 + rule.priority;
      if (score > bestScore || (score === bestScore && rule.priority > bestPriority)) {
        bestScore = score;
        bestType = rule.element_type;
        bestPriority = rule.priority;
      }
    }
  }

  const confidence = bestType === 'other' ? 0.3 : Math.min(1.0, 0.6 + bestScore * 0.04);
  const catalog = ELEMENT_CATALOG[bestType];

  return {
    element_type: bestType,
    confidence,
    ...catalog,
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
 * Returns the best-matching system from the catalog.
 */
export function recommendFormwork(type: StructuralElementType): FormworkSystemSpec {
  const profile = ELEMENT_CATALOG[type];
  const systemName = profile.recommended_formwork[0];
  return FORMWORK_SYSTEMS.find(s => s.name === systemName) ?? FORMWORK_SYSTEMS[0];
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
