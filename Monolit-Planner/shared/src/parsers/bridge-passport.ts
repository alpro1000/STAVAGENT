/**
 * bridge-passport — half A of tz-passport-json (ratified 2026-07-07).
 *
 * Deterministic mapper: per-SO bridge passport (JSON, schema single-source =
 * Pydantic `app/models/bridge_passport.py` in Core) → PlannerInput[] for the
 * canonical engine. The passport is WRITTEN by half B (extraction — TZ text,
 * drawings via vision, soupis join); this side only READS.
 *
 * Ratified ACs implemented here:
 *  - TZ value is the calculation default; a soupis class that differs is a
 *    VISIBLE warning — unless it is an OTSKP price band («DO C40/50»,
 *    Pattern 53), which is a different axis → informative note, not conflict.
 *  - Honest-ignore: passport fields the engine does not consume are skipped
 *    silently; unknown sections never break the mapper.
 *  - Missing quantities: the element is STILL emitted (volume 0) — the engine
 *    marks it NEPOČÍTÁNO (UncalculatedError, v4.38), never a fabricated m³.
 *  - Per-SO passport; symmetric bridge elements are split per deck
 *    (volume ÷ decks.length, num_bridges = decks.length); whole-SO scoped
 *    elements (podkladní beton, patky) stay unsplit.
 */

import type { PlannerInput } from '../calculators/planner-orchestrator.js';
import { planProject, type ProjectOutput } from '../calculators/project-planner.js';
import type { StructuralElementType } from '../calculators/pour-decision.js';
import type { ConstructionTechnology } from '../calculators/bridge-technology.js';

// ─── Result shapes ───────────────────────────────────────────────────────────

export interface PassportMappedElement {
  /** Passport element key (quantities.items[].element / concretes[].use). */
  key: string;
  input: PlannerInput;
  /** ℹ️ informative notes (e.g. OTSKP band, omitted class). */
  notes: string[];
}

export interface PassportMapResult {
  elements: PassportMappedElement[];
  /** ⚠️ passport-level + conflict warnings (visible, never silently resolved). */
  warnings: string[];
}

// ─── Element key → engine type (per-SO bridge passport) ─────────────────────

interface ElementRule {
  engine_type: StructuralElementType;
  /** Symmetric per-deck element (÷ decks, num_bridges = decks) vs whole-SO. */
  per_deck: boolean;
  /** materials_and_standards.concretes[].use key for the TZ class (if differs from element key). */
  concrete_use?: string;
}

const ELEMENT_RULES: Record<string, ElementRule> = {
  superstructure_deck: { engine_type: 'mostovkova_deska', per_deck: true },
  pier_shafts: { engine_type: 'driky_piliru', per_deck: true },
  abutments: { engine_type: 'opery_ulozne_prahy', per_deck: true },
  foundations_piers: { engine_type: 'zaklady_piliru', per_deck: true, concrete_use: 'foundations' },
  foundations_abutments: { engine_type: 'zaklady_oper', per_deck: true, concrete_use: 'foundations' },
  transition_slabs: { engine_type: 'prechodova_deska', per_deck: true },
  rims: { engine_type: 'rimsa', per_deck: true },
  // Whole-SO scope (blinding layers span both decks' footprints):
  blinding_concrete: { engine_type: 'podkladni_beton', per_deck: false },
  // Prostý beton — computed as podkladni_beton (rebar 0 by design; honest
  // simplification, noted per element).
  plain_footings: { engine_type: 'podkladni_beton', per_deck: false },
};

// ─── Concrete class string parsing ───────────────────────────────────────────

/** Parse a full TZ class string «C30/37-XF4+XD3+XC4» → strength + ALL exposure
 *  classes. The concrete must satisfy every listed class simultaneously, so the
 *  mapper forwards the whole list (engine `exposure_classes` — preferred API,
 *  curing = max across all; bug `passport-exposure-single`, 2026-07-11).
 *  `exposure_class` (first token) is kept for callers that want a display
 *  label — the mapper itself no longer forwards it. */
export function parseConcreteClassString(full: string): {
  concrete_class?: string;
  exposure_class?: string;
  exposure_all: string[];
} {
  const strength = full.match(/C\s?(\d{2}\/\d{2})/i);
  const exposures = full.match(/X[ACDFMS]\d/gi) ?? [];
  return {
    concrete_class: strength ? `C${strength[1]}` : undefined,
    exposure_class: exposures[0]?.toUpperCase(),
    exposure_all: exposures.map(e => e.toUpperCase()),
  };
}

// ─── Falsework height from geometry ──────────────────────────────────────────

/**
 * Governing falsework height for the deck: max of geometry.decks[].
 * `deck_height_over_terrain_m` — a number OR an object per crossing
 * ({road: 8.1, stream: 14.9, …}). The tallest crossing governs the falsework
 * system family (towers are not swapped mid-bridge); we deliberately do NOT
 * subtract the NK construction depth (the field may already measure to the
 * soffit — clearance convention), so the estimate errs on the expensive side.
 * (bug `passport-height-skruz`, 2026-07-11)
 */
export function maxDeckHeightOverTerrain(decks: any[]): number | undefined {
  let max: number | undefined;
  for (const d of decks ?? []) {
    const v = d?.deck_height_over_terrain_m;
    const vals: number[] =
      typeof v === 'number' ? [v]
      : v && typeof v === 'object' ? Object.values(v).map(Number) : [];
    for (const n of vals) {
      if (Number.isFinite(n) && n > 0 && (max === undefined || n > max)) max = n;
    }
  }
  return max;
}

// ─── Deck subtype from passport wording ──────────────────────────────────────

function deckSubtype(passport: any): string | undefined {
  const girders = passport?.structural_system?.girder_count_per_deck;
  if (girders === 2) return 'dvoutramovy';
  if (girders === 1) return 'jednotramovy';
  const t = String(passport?.structural_system?.type ?? passport?.superstructure?.deck?.type ?? '');
  if (/two_girder|dvoutram/i.test(t)) return 'dvoutramovy';
  if (/box|komor/i.test(t)) return 'komorovy';
  if (/slab|deskov/i.test(t)) return 'deskovy';
  return undefined;
}

// ─── Main mapper ─────────────────────────────────────────────────────────────

export function mapPassportToPlannerInputs(passport: any): PassportMapResult {
  const warnings: string[] = [];
  const elements: PassportMappedElement[] = [];

  const meta = passport?._meta;
  if (meta?.schema && meta.schema !== 'tz-bridge-passport') {
    warnings.push(`⚠️ Neznámé schéma passportu '${meta.schema}' — mapper pokračuje best-effort.`);
  }

  const decks: any[] = passport?.geometry?.decks ?? [];
  const decksCount = Math.max(1, decks.length);
  const spans: number[] = passport?.superstructure?.deck?.spans_m
    ?? passport?.geometry?.spans ?? [];
  const nkWidth: number | undefined = passport?.superstructure?.deck?.width_per_deck_m
    ?? decks[0]?.deck_width_m;

  // TZ concrete classes per use — the calculation DEFAULT (ratified AC 4).
  const tzClassByUse = new Map<string, string>();
  for (const c of passport?.materials_and_standards?.concretes ?? []) {
    if (c?.use && c?.class) tzClassByUse.set(String(c.use), String(c.class));
  }

  // Quantities by element key (soupis join). Missing = honest volume 0.
  const qtyByElement = new Map<string, any>();
  for (const it of passport?.quantities?.items ?? []) {
    if (it?.element) qtyByElement.set(String(it.element), it);
  }

  // Union of keys: quantities ∪ known uses with a rule — quantities drive the
  // real list; a concretes-only key still emits (volume 0 → NEPOČÍTÁNO).
  const keys = new Set<string>([
    ...qtyByElement.keys(),
    ...[...tzClassByUse.keys()].filter(u => ELEMENT_RULES[u]),
  ]);

  const cp = passport?.construction_process;
  const technology: ConstructionTechnology | undefined = cp?.falsework_technology;
  const pourStages: number | undefined = cp?.deck_pour_stages;
  const isPrestressed =
    /post_tension|predpj|předpj/i.test(String(passport?.structural_system?.type ?? '')) ||
    Boolean(passport?.superstructure?.deck?.post_tensioning) ||
    Boolean(passport?.materials_and_standards?.post_tensioning);

  for (const key of keys) {
    const rule = ELEMENT_RULES[key];
    if (!rule) {
      warnings.push(`⚠️ Passport prvek '${key}' nemá mapování na engine typ — přeskočen (honest-ignore).`);
      continue;
    }
    const qty = qtyByElement.get(key);
    const notes: string[] = [];

    // TZ class default + Pattern 53 band handling
    const tzClassFull = tzClassByUse.get(rule.concrete_use ?? key);
    const parsed = tzClassFull ? parseConcreteClassString(tzClassFull) : undefined;
    const soupisClass: string | undefined = qty?.concrete_class_soupis;
    if (tzClassFull && soupisClass) {
      const tzStrength = parsed?.concrete_class;
      const bandStrength = soupisClass.match(/C\s?(\d{2}\/\d{2})/i)?.[1];
      const differs = tzStrength && bandStrength && tzStrength !== `C${bandStrength}`;
      if (differs && qty?.soupis_class_is_otskp_band) {
        notes.push(
          `ℹ️ Soupis '${soupisClass}' = OTSKP cenové pásmo, ne marka (Pattern 53) — ` +
          `počítáno s TZ třídou ${tzStrength} (informativní, ne konflikt).`
        );
      } else if (differs) {
        warnings.push(
          `⚠️ Konflikt TZ↔soupis u '${key}': TZ ${tzStrength} vs soupis ${soupisClass} — ` +
          `výpočet používá TZ hodnotu (projektová dokumentace > soupis).`
        );
      }
    }
    if (!tzClassFull) {
      notes.push(`ℹ️ Passport nenese TZ třídu betonu pro '${key}' — engine použije vlastní default (žádná fabrikace).`);
    }

    const perDeckDiv = rule.per_deck ? decksCount : 1;
    const volumeWhole: number = Number(qty?.volume_m3 ?? 0);
    const input: PlannerInput = {
      element_type: rule.engine_type,
      volume_m3: volumeWhole > 0 ? round2(volumeWhole / perDeckDiv) : 0,
      has_dilatacni_spary: false,
      ...(parsed?.concrete_class ? { concrete_class: parsed.concrete_class as any } : {}),
      // ALL exposure classes (engine computes curing from the most demanding
      // one and flags rogue classes per element — single source of truth).
      ...(parsed && parsed.exposure_all.length > 0 ? { exposure_classes: parsed.exposure_all } : {}),
      ...(rule.per_deck && decksCount > 1 ? { num_bridges: decksCount } : {}),
      ...(qty?.height_m ? { height_m: Number(qty.height_m) } : {}),
      ...(qty?.rebar_mass_kg ? { rebar_mass_kg: round2(Number(qty.rebar_mass_kg) / perDeckDiv) } : {}),
    } as PlannerInput;

    if (rule.engine_type === 'mostovkova_deska') {
      if (spans.length > 0) {
        (input as any).span_m = Math.max(...spans);
        (input as any).num_spans = spans.length;
      }
      if (nkWidth) (input as any).nk_width_m = nkWidth;
      // Falsework height (skruž + stojky = typically 15-25 % of deck costs):
      // explicit qty.height_m wins; otherwise derive from geometry heights.
      if ((input as any).height_m === undefined) {
        const h = maxDeckHeightOverTerrain(decks);
        if (h !== undefined) {
          (input as any).height_m = h;
          notes.push(
            `ℹ️ Výška skruže odvozena z geometry.decks deck_height_over_terrain_m: ` +
            `max = ${h} m (nejvyšší křížení řídí volbu systému; bez odpočtu stavební výšky NK — konzervativně).`
          );
        }
      }
      // NK construction depth → deck cross-section thickness (volume plausibility).
      const nkDepth = Number(
        passport?.superstructure?.deck?.constant_depth_m
        ?? passport?.structural_system?.constant_depth_m ?? NaN,
      );
      if (Number.isFinite(nkDepth) && nkDepth > 0) (input as any).deck_thickness_m = nkDepth;
      const subtype = deckSubtype(passport);
      if (subtype) (input as any).bridge_deck_subtype = subtype;
      if (isPrestressed) (input as any).is_prestressed = true;
      if (technology) (input as any).construction_technology = technology;
      if (qty?.prestress_strand_mass_kg) {
        (input as any).prestress_strand_mass_kg = round2(Number(qty.prestress_strand_mass_kg) / perDeckDiv);
      }
      // Documented pour staging: honor it (num_tacts_override) AND carry the
      // provenance (tz_facts) so the validation rule stays consistent. If a
      // future engine drops the override mechanism, tz_facts alone keeps the
      // fact visible — graceful degrade, not an error.
      if (pourStages && pourStages >= 1) {
        (input as any).num_tacts_override = pourStages;
        (input as any).tz_facts = {
          construction: {
            ...(technology ? { technology } : {}),
            pour_stages_count: pourStages,
            quote: String(cp?.deck_pour_stages_source ?? 'passport: construction_process.deck_pour_stages'),
            anchor: String(cp?.deck_pour_stages_source ?? 'passport'),
          },
        };
      }
    }

    if (rule.engine_type === 'rimsa' && qty?.length_bm) {
      (input as any).total_length_m = round2(Number(qty.length_bm) / perDeckDiv);
    }
    if (key === 'plain_footings') {
      notes.push('ℹ️ Patky z prostého betonu počítány jako podkladní beton (rebar 0, tesařské bednění) — zjednodušení.');
    }
    if (volumeWhole <= 0) {
      notes.push(`ℹ️ Chybí množství pro '${key}' — element emitován bez objemu, engine jej označí NEPOČÍTÁNO.`);
    }

    elements.push({ key, input, notes });
  }

  if (elements.length === 0) {
    warnings.push('⚠️ Passport neobsahuje žádný mapovatelný betonový prvek (quantities i concretes prázdné).');
  }
  return { elements, warnings };
}

/** Map + compute through the canonical aggregation (planProject — per-element
 *  failures isolate as elements_uncalculated, honest partial totals). */
export function planPassport(passport: any): { mapping: PassportMapResult; project: ProjectOutput } {
  const mapping = mapPassportToPlannerInputs(passport);
  const project = planProject(mapping.elements.map(e => e.input));
  return { mapping, project };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
