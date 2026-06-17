/**
 * Formwork Systems Catalog — Single Source of Truth
 *
 * Canonical data for all formwork systems used across backend and frontend.
 * Sources: DOKA price lists 2024, B3_current_prices, industry standards.
 *
 * Import this instead of maintaining separate copies in frontend/backend.
 */

import type { StructuralElementType } from '../calculators/pour-decision.js';
import { KB_DOKA_FORMWORK_SYSTEMS } from '../kb-generated/doka-frami-catalog.js';
import { KB_NON_DOKA_FORMWORK_SYSTEMS } from '../kb-generated/formwork-catalog-non-doka.js';

/**
 * Pour role (2026-04-17, expanded 2026-04-29 Gate 2.1): layer role in the
 * concreting assembly. Drives UI card labels so users see "🏗️ Skruž"
 * (falsework — věže) vs "🔩 Stojky" (props — věže) vs "📦 Bednění"
 * (formwork — forma/desky) explicitly instead of one generic "Bednění"
 * card. Parallel to `formwork_category` which stays a technical filter
 * (wall/slab/column/…).
 *
 *  - 'formwork'        — pure side/face form (Framax, MAXIMO, Frami, Top 50,
 *                        VARIO GT 24). Vertical, cornice or deck-side.
 *                        Sub-classified via `formwork_subtype` (rámové vs
 *                        nosníkové).
 *  - 'formwork_props'  — slab form with built-in props (Dokaflex,
 *                        MULTIFLEX, SKYDECK, CC-4). Applies up to
 *                        ~5 m clear height; above that a falsework +
 *                        separate props is needed.
 *  - 'formwork_beam'   — horizontal load-spreading beam component
 *                        (VARIOKIT HD 200, Top 50 H20 accessory beams).
 *                        Sits ABOVE falsework towers and BELOW deck
 *                        formwork; distributes deck load into towers.
 *  - 'falsework'       — těžká podpěrná skruž (Staxo 100, UniKit, VARIOKIT
 *                        VST). Carries deck formwork load into the ground.
 *                        Statický návrh od výrobce nutný.
 *  - 'props'           — stojky / lehké věže (Staxo 40, MULTIPROP, Eurex).
 *                        Stropní podepření v budovách. Grid-spaced.
 *  - 'mss_integrated'  — MSS / movable scaffolding system. Carries form
 *                        + falsework + props in one unit; per-tact labor
 *                        collapses by `mss_reuse_factor` (0.35 of full
 *                        mount) and rental of individual components
 *                        (bednění/skruž/stojky) is 0 — bundled in MSS
 *                        mobilization + monthly rental.
 *
 * Canonical reference: docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md
 */
export type PourRole = 'formwork' | 'formwork_props' | 'formwork_beam' | 'falsework' | 'props' | 'mss_integrated';

/**
 * Formwork sub-taxonomy (2026-04-29 Gate 2.1, canonical doc §9.1):
 * sub-classification of `formwork` and `formwork_beam` pour_roles per
 * DOKA/PERI catalog conventions.
 *
 *  - 'ramove'    — rámové (frame-based, fixed grid, plug-and-play): Frami,
 *                  Framax, TRIO, MAXIMO, DUO. Economical for typical
 *                  walls and abutments.
 *  - 'nosnikove' — nosníkové (beam-supported, custom geometry): Top 50,
 *                  VARIO GT 24. Tailor-made; integrates with falsework
 *                  for bridge decks and tall walls.
 *  - 'stropni'   — stropní / tablovací (slab/table form with built-in
 *                  props): Dokaflex, MULTIFLEX, SKYDECK, CC-4. Building
 *                  slabs only — NOT for bridge decks.
 *  - 'beam'      — horizontal load-spreading beam component (VARIOKIT
 *                  HD 200, Top 50 H20). Used as accessory on top of
 *                  falsework towers.
 */
export type FormworkSubtype = 'ramove' | 'nosnikove' | 'stropni' | 'beam';

/** Formwork system specification */
export interface FormworkSystemSpec {
  name: string;
  manufacturer: string;
  heights: string[];
  /** Assembly labor norm (hours per m² or per bm when unit='bm') */
  assembly_h_m2: number;
  /** Disassembly labor norm (hours per m² or per bm) — derived: assembly_h_m2 × disassembly_ratio */
  disassembly_h_m2: number;
  /** Disassembly as fraction of assembly time (0.25–0.50) */
  disassembly_ratio: number;
  /** Monthly rental price per m² (or per bm). 0 = no rental (e.g. traditional timber) */
  rental_czk_m2_month: number;
  /** Measurement unit: 'm2' (default) or 'bm' (linear meters, e.g. cornice formwork) */
  unit: 'm2' | 'bm';
  description: string;

  // ── Technical specs (optional, from PERI/DOKA catalogs) ──────────────
  /** Panel weight (kg/m²) — affects crane requirement and handling */
  weight_kg_m2?: number;
  /** Max fresh concrete pressure (kN/m²) — determines pour rate limit */
  pressure_kn_m2?: number;
  /** Max pour height per stage (m) — panel combination limit */
  max_pour_height_m?: number;
  /**
   * Max physical reach of the system (m). Separate from max_pour_height_m
   * which is the per-stage pour limit. Used by selector to decide whether
   * a `formwork_props` system (e.g. Dokaflex Europlus ~4 m) can cover the
   * clear height or a `falsework` + `props` combo is needed instead.
   * When undefined, the system is assumed unlimited for its pour_role.
   */
  max_assembly_height_m?: number;
  /** Max single panel weight (kg) — determines if crane needed */
  max_panel_weight_kg?: number;
  /** Whether crane is required for assembly/relocation */
  needs_crane?: boolean;
  /** Minimum radius for circular formwork (m) — only for RUNDFLEX, SRS */
  min_radius_m?: number;
  /** Standard panel widths available (mm) */
  panel_widths_mm?: number[];
  /** Purchase price per m² (CZK) — multi-use purchase from PERI offer */
  purchase_czk_m2?: number;
  /** Formwork category: wall, slab, column, special, universal, support_tower */
  formwork_category?: 'wall' | 'slab' | 'column' | 'special' | 'universal' | 'support_tower';

  // ── Pour-role taxonomy (2026-04-17) ──────────────────────────────────
  /**
   * Which layer of the concreting assembly this system belongs to.
   * Drives UI card labels and cost-summary bucketing.
   */
  pour_role?: PourRole;
  /**
   * Sub-classification of `formwork` and `formwork_beam` pour_roles per
   * DOKA/PERI catalog (canonical doc §9.1). Optional — only set on
   * those two pour_roles. Drives UI sub-taxonomy display in Gate 3.
   */
  formwork_subtype?: FormworkSubtype;
  /**
   * Optional element-type allow-list. When set, the selector only offers
   * this system for the listed element types. Undefined = universal
   * (offered whenever other filters pass).
   *
   * Use this to prevent Dokaflex/MULTIFLEX/SKYDECK/CC-4 being proposed
   * for bridge decks — their max reach is ~5 m and structurally they
   * are building slab formwork, not bridge falsework.
   */
  applicable_element_types?: StructuralElementType[];
  /**
   * MSS only (pour_role='mss_integrated'): fraction of full formwork
   * labor that a per-tact move consumes. Real DOKA MSS on site runs at
   * ~35 % of full-mount hours because the deck form just moves + gets
   * re-tensioned; it doesn't get rebuilt from zero.
   */
  mss_reuse_factor?: number;
}

/**
 * All formwork systems — 30 systems (DOKA, PERI, ULMA, NOE, Místní).
 *
 * Fully KB-sourced — edit the YAML, run `npm run gen:knowledge`, never hardcode:
 *   DOKA                       → kb/doka_frami_catalog.yaml
 *   PERI / ULMA / NOE / Místní → kb/formwork_catalog_non_doka.yaml
 * Composed below as [...KB_DOKA, ...KB_NON_DOKA]; list order is load-bearing
 * (FORMWORK_SYSTEMS[0] = default system; some selection paths are order-aware).
 *
 * Assembly norms represent person-hours per m² (or per bm).
 * Disassembly_h_m2 = assembly_h_m2 × disassembly_ratio.
 *
 * Sources: DOKA price lists 2024, PERI catalog 2024/2025, ULMA CZ 2024,
 *          NOE-Schaltechnik catalog 2024, industry standards.
 *          PERI offer DO-25-0056409 (D6 Karlovy Vary, 2025-03-30).
 *          PERI product brochures (prospekty): weight, pressure, panel specs.
 */
export const FORMWORK_SYSTEMS: FormworkSystemSpec[] = [
  // ── DOKA — sourced from kb/doka_frami_catalog.yaml ───────────────────
  // (Frami Xlife, Framax Xlife, Top 50, Dokaflex, SL-1, Římsové bednění T,
  //  Římsový vozík TU/T, Staxo 100, DOKA MSS — see KB YAML for full list)
  ...KB_DOKA_FORMWORK_SYSTEMS,
  // ── Non-DOKA (PERI / ULMA / NOE / Místní) — sourced from
  //    kb/formwork_catalog_non_doka.yaml (verbatim lift, Gate C 2026-06-17).
  //    Composed AFTER the DOKA spread; list order preserved so goldens freeze.
  ...KB_NON_DOKA_FORMWORK_SYSTEMS,
];

/** Find a formwork system by name */
export function findFormworkSystem(name: string): FormworkSystemSpec | undefined {
  return FORMWORK_SYSTEMS.find(s => s.name === name);
}

/** Get default formwork system (Frami Xlife) */
export function getDefaultFormworkSystem(): FormworkSystemSpec {
  return FORMWORK_SYSTEMS[0];
}

/** Filter systems that don't require crane (manual handling only) */
export function getManualFormworkSystems(): FormworkSystemSpec[] {
  return FORMWORK_SYSTEMS.filter(s => s.needs_crane === false);
}

/** Filter systems by maximum concrete pressure (kN/m²) */
export function getSystemsByMinPressure(minPressure: number): FormworkSystemSpec[] {
  return FORMWORK_SYSTEMS.filter(s => s.pressure_kn_m2 != null && s.pressure_kn_m2 >= minPressure);
}

/**
 * Pour-role helpers (2026-04-17). Used by the selector + UI rendering to
 * group systems by their layer role (formwork / formwork_props /
 * falsework / props / mss_integrated).
 */
export function getSystemsByPourRole(role: PourRole): FormworkSystemSpec[] {
  return FORMWORK_SYSTEMS.filter(s => s.pour_role === role);
}

/**
 * Allow-list check: when a system has `applicable_element_types`, the
 * selector must only offer it for listed types. Undefined allow-list
 * means the system is universal (offered whenever other filters pass).
 *
 * This prevents Dokaflex / MULTIFLEX / SKYDECK / CC-4 from being
 * proposed for bridge decks — structurally they're building slab
 * formwork (max ~5 m reach), not bridge falsework.
 */
export function isApplicableForElement(
  system: FormworkSystemSpec,
  elementType: StructuralElementType,
): boolean {
  if (!system.applicable_element_types) return true;
  return system.applicable_element_types.includes(elementType);
}

/** Find MSS system for a preferred manufacturer, falling back to first MSS entry. */
export function findMssSystem(preferred_manufacturer?: string): FormworkSystemSpec | undefined {
  const mssSystems = getSystemsByPourRole('mss_integrated');
  if (preferred_manufacturer) {
    const match = mssSystems.find(s =>
      s.manufacturer.toLowerCase() === preferred_manufacturer.toLowerCase()
    );
    if (match) return match;
  }
  return mssSystems[0];
}
