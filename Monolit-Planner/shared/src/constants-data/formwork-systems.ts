/**
 * Formwork Systems Catalog — Single Source of Truth
 *
 * Canonical data for all formwork systems used across backend and frontend.
 * Sources: DOKA price lists 2024, B3_current_prices, industry standards.
 *
 * Import this instead of maintaining separate copies in frontend/backend.
 */

import type { StructuralElementType } from '../calculators/pour-decision.js';

/**
 * Pour role (2026-04-17): layer role in the concreting assembly. Drives UI
 * card labels so users see "🏗️ Skruž" (falsework — nosníky) vs "🔩 Stojky"
 * (props — věže) vs "📦 Bednění" (formwork — forma/desky) explicitly
 * instead of one generic "Bednění" card. Parallel to `formwork_category`
 * which stays a technical filter (wall/slab/column/…).
 *
 *  - 'formwork'        — pure side/face form (Framax, MAXIMO, Frami).
 *                        Vertical or cornice. No integrated props.
 *  - 'formwork_props'  — slab form with built-in props (Dokaflex,
 *                        MULTIFLEX, SKYDECK, CC-4). Applies up to
 *                        ~5 m clear height; above that a falsework +
 *                        separate props is needed.
 *  - 'falsework'       — nosníková skruž (Top 50, VARIOKIT engineering
 *                        kit). Carries the deck formwork. Combined
 *                        with `props` pour_role systems underneath.
 *  - 'props'           — stojky / věže (Staxo 40/100, UP Rosett, VST).
 *                        Carry the falsework. Grid-spaced towers.
 *  - 'mss_integrated'  — MSS / movable scaffolding system. Carries form
 *                        + falsework + props in one unit; per-tact labor
 *                        collapses by `mss_reuse_factor` (0.35 of full
 *                        mount) and rental of individual components
 *                        (bednění/skruž/stojky) is 0 — bundled in MSS
 *                        mobilization + monthly rental.
 */
export type PourRole = 'formwork' | 'formwork_props' | 'falsework' | 'props' | 'mss_integrated';

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
 * All formwork systems — 25 systems (DOKA, PERI, ULMA, NOE, Místní)
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
  // ── DOKA ─────────────────────────────────────────────────────────────
  {
    name: 'Frami Xlife',
    manufacturer: 'DOKA',
    heights: ['0.30', '0.60', '0.90', '1.20', '1.50'],
    assembly_h_m2: 0.72,
    disassembly_h_m2: 0.25,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 507.20,
    unit: 'm2',
    description: 'Rámové bednění pro základy, opěry, nízké stěny — ruční montáž, vzpěry IB pro h>1.2m',
    weight_kg_m2: 30,
    pressure_kn_m2: 80,
    max_pour_height_m: 3.0,
    max_panel_weight_kg: 52,
    needs_crane: false,
    panel_widths_mm: [300, 450, 600, 750, 900],
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'Framax Xlife',
    manufacturer: 'DOKA',
    heights: ['2.70', '3.00', '3.30', '5.40'],
    assembly_h_m2: 0.55,
    disassembly_h_m2: 0.17,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 520.00,
    unit: 'm2',
    description: 'Velkoformátové rámové bednění pro vysoké stěny, pilíře — vyžaduje jeřáb (panel 154–259 kg)',
    weight_kg_m2: 56,
    // BUG 6: raised 100→120 — Framax Xlife max config (TIE pattern + walers) per DOKA TI
    pressure_kn_m2: 120,
    max_pour_height_m: 6.75,
    max_panel_weight_kg: 350,
    needs_crane: true,
    panel_widths_mm: [300, 450, 600, 900, 1200],
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'Top 50',
    manufacturer: 'DOKA',
    heights: ['0.50', '1.00', '1.50', '2.00'],
    assembly_h_m2: 0.60,
    disassembly_h_m2: 0.21,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 380.00,
    unit: 'm2',
    description: 'Nosníková skruž Top 50 — mostovky + stropy, unášený roštový systém s dřevěnými nosníky H20 nebo ocelovými GT 24',
    weight_kg_m2: 25,
    pressure_kn_m2: 75,
    needs_crane: true,
    formwork_category: 'slab',
    // Pour role: falsework (nosníky). Top 50 nese bednění (desky) — není
    // to forma samotná, je to skruž. Pro most ho engine kombinuje s
    // props (Staxo) od stejného výrobce.
    pour_role: 'falsework',
  },
  {
    name: 'Dokaflex',
    manufacturer: 'DOKA',
    heights: ['do 5.50'],
    assembly_h_m2: 0.45,
    disassembly_h_m2: 0.14,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 350.00,
    unit: 'm2',
    description: 'Flexibilní stropní bednění s nosníky H20 a Europlus stojkami v jednom systému (do ~5 m čisté výšky, budovy)',
    weight_kg_m2: 18,
    max_assembly_height_m: 5.5,
    needs_crane: false,
    formwork_category: 'slab',
    // Building slab formwork + integrated props. NE mostovka — tam chybí
    // dosah (max Europlus ~4–5 m) + reálně se pro most používá Top 50
    // jako nosníková skruž. Allow-list drží selector mimo mostovka.
    pour_role: 'formwork_props',
    applicable_element_types: ['stropni_deska', 'zakladova_deska', 'zakladovy_pas', 'pruvlak'],
  },
  {
    name: 'SL-1 Sloupové',
    manufacturer: 'DOKA',
    heights: ['3.00', '4.50', '6.00'],
    assembly_h_m2: 0.80,
    disassembly_h_m2: 0.28,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 580.00,
    unit: 'm2',
    description: 'Sloupové bednění pro pilíře mostů',
    weight_kg_m2: 65,
    pressure_kn_m2: 80,
    needs_crane: true,
    formwork_category: 'column',
    pour_role: 'formwork',
    applicable_element_types: ['sloup', 'driky_piliru'],
  },
  {
    name: 'Římsové bednění T',
    manufacturer: 'DOKA',
    heights: ['libovolná'],
    assembly_h_m2: 0.38,
    disassembly_h_m2: 0.10,
    disassembly_ratio: 0.25,
    rental_czk_m2_month: 672.00,
    unit: 'bm',
    description: 'Konzolové bednění říms mostu (0,30–0,45 h/bm, 672 Kč/bm/měs)',
    needs_crane: true,
    formwork_category: 'special',
    pour_role: 'formwork',
    applicable_element_types: ['rimsa'],
  },
  {
    name: 'Římsový vozík TU',
    manufacturer: 'DOKA',
    heights: ['libovolná'],
    assembly_h_m2: 0.45,
    disassembly_h_m2: 0.12,
    disassembly_ratio: 0.27,
    rental_czk_m2_month: 850.00,
    unit: 'bm',
    description: 'Římsový vozík TU — mosty >150 m, oblouky R≥250 m, takt 4–24 m (672–850 Kč/bm/měs)',
    needs_crane: true,
    formwork_category: 'special',
    pour_role: 'formwork',
    applicable_element_types: ['rimsa'],
  },
  {
    name: 'Římsový vozík T',
    manufacturer: 'DOKA',
    heights: ['libovolná'],
    assembly_h_m2: 0.42,
    disassembly_h_m2: 0.11,
    disassembly_ratio: 0.26,
    rental_czk_m2_month: 780.00,
    unit: 'bm',
    description: 'Římsový vozík T — přímé mosty >150 m, takt max 5 m, protizávaží na mostovce',
    needs_crane: true,
    formwork_category: 'special',
    pour_role: 'formwork',
    applicable_element_types: ['rimsa'],
  },
  // ── Bridge support towers (podpěrné věže) ──────────────────────────
  {
    name: 'Staxo 100',
    manufacturer: 'DOKA',
    heights: ['5.00', '10.00', '15.00', '20.00'],
    assembly_h_m2: 0.90,
    disassembly_h_m2: 0.30,
    disassembly_ratio: 0.33,
    rental_czk_m2_month: 380.00,
    unit: 'm2',
    description: 'Podpěrné věže Staxo 100 — mosty výška 5–20 m, raster 1.25×1.25 m (stojky pod nosníkovou skruž Top 50)',
    needs_crane: true,
    max_assembly_height_m: 20,
    formwork_category: 'support_tower',
    // Pour role: props (stojky) — věže pod nosníkovou skruží.
    pour_role: 'props',
    applicable_element_types: ['mostovkova_deska', 'rigel', 'stropni_deska', 'pruvlak', 'schodiste'],
  },
  {
    name: 'UP Rosett Flex',
    manufacturer: 'PERI',
    heights: ['5.00', '10.00', '15.00', '20.00', '25.00'],
    assembly_h_m2: 1.10,
    disassembly_h_m2: 0.35,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 420.00,
    unit: 'm2',
    description: 'Modulární lešení/podpěrné věže UP Rosett — výška do 25 m, variabilní geometrie (stojky pod nosníkovou skruž)',
    needs_crane: true,
    max_assembly_height_m: 25,
    formwork_category: 'support_tower',
    pour_role: 'props',
    applicable_element_types: ['mostovkova_deska', 'rigel', 'stropni_deska', 'pruvlak', 'schodiste'],
  },
  // ── PERI ─────────────────────────────────────────────────────────────
  {
    name: 'TRIO',
    manufacturer: 'PERI',
    heights: ['2.70', '3.30', '5.40'],
    assembly_h_m2: 0.50,
    disassembly_h_m2: 0.15,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 736.00,
    unit: 'm2',
    description: 'Rámové bednění PERI pro opěry mostů (h=2,7–5,4 m, ~50 kg/m², tlak 80 kN/m²)',
    weight_kg_m2: 50,
    pressure_kn_m2: 80,
    max_panel_weight_kg: 230,
    needs_crane: true,
    panel_widths_mm: [300, 330, 600, 720, 900, 1200],
    purchase_czk_m2: 4866,
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'MAXIMO',
    manufacturer: 'PERI',
    heights: ['2.70', '3.30', '3.60'],
    assembly_h_m2: 0.40,
    disassembly_h_m2: 0.12,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 550.00,
    unit: 'm2',
    description: 'Velkoformátové stěnové bednění PERI bez viditelných kotev (~55 kg/m², tlak 80 kN/m², MX spínání)',
    weight_kg_m2: 55,
    pressure_kn_m2: 80,
    max_panel_weight_kg: 510,
    needs_crane: true,
    panel_widths_mm: [300, 450, 600, 900, 1200, 2400],
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'DOMINO',
    manufacturer: 'PERI',
    heights: ['1.00', '1.25', '1.50', '2.00', '2.25', '2.50', '3.75'],
    assembly_h_m2: 0.65,
    disassembly_h_m2: 0.20,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 658.00,
    unit: 'm2',
    description: 'Lehké ruční bednění PERI (~24 kg/m² alu, tlak 50–60 kN/m², základy, opěry, propustky)',
    weight_kg_m2: 24,
    pressure_kn_m2: 55,
    max_panel_weight_kg: 50,
    needs_crane: false,
    panel_widths_mm: [250, 300, 375, 500, 625, 750],
    purchase_czk_m2: 4092,
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'SKYDECK',
    manufacturer: 'PERI',
    heights: ['do 6.00'],
    assembly_h_m2: 0.35,
    disassembly_h_m2: 0.11,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 400.00,
    unit: 'm2',
    description: 'Panelové stropní bednění PERI (~14 kg/m², 0,29 stojek/m², rychlé odbednění po 1 dni, do ~6 m, budovy)',
    weight_kg_m2: 14,
    max_panel_weight_kg: 20,
    max_assembly_height_m: 6,
    needs_crane: false,
    formwork_category: 'slab',
    pour_role: 'formwork_props',
    applicable_element_types: ['stropni_deska', 'zakladova_deska', 'pruvlak'],
  },
  {
    name: 'VARIO GT 24',
    manufacturer: 'PERI',
    heights: ['3.00', '6.00', '9.00', '12.00'],
    assembly_h_m2: 0.85,
    disassembly_h_m2: 0.26,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 600.00,
    unit: 'm2',
    description: 'Nosníkové bednění pro vysoké stěny a pilíře (do 12 m)',
    weight_kg_m2: 60,
    pressure_kn_m2: 80,
    needs_crane: true,
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'VARIO',
    manufacturer: 'PERI',
    heights: ['4.50', '6.00', '8.10', '12.50'],
    assembly_h_m2: 0.90,
    disassembly_h_m2: 0.27,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 807.00,
    unit: 'm2',
    description: 'Zakázkové panelové bednění PERI pro mostní pilíře (průřezy 1,2–2,4 m, výšky 4,5–12,5 m)',
    weight_kg_m2: 65,
    pressure_kn_m2: 80,
    needs_crane: true,
    purchase_czk_m2: 5133,
    formwork_category: 'column',
    pour_role: 'formwork',
    applicable_element_types: ['sloup', 'driky_piliru'],
  },
  {
    name: 'DUO',
    manufacturer: 'PERI',
    heights: ['0.75', '1.00', '1.25', '1.50', '2.70'],
    assembly_h_m2: 0.55,
    disassembly_h_m2: 0.17,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 450.00,
    unit: 'm2',
    description: 'Univerzální lehké bednění PERI pro stěny i stropy (~22 kg/m², max. 25 kg/díl, bez jeřábu, tlak 50 kN/m²)',
    weight_kg_m2: 22,
    pressure_kn_m2: 50,
    max_panel_weight_kg: 25,
    needs_crane: false,
    panel_widths_mm: [250, 500, 750, 1000],
    formwork_category: 'universal',
    pour_role: 'formwork',
  },
  {
    name: 'QUATTRO',
    manufacturer: 'PERI',
    heights: ['2.50', '2.75', '3.50', '4.50'],
    assembly_h_m2: 0.75,
    disassembly_h_m2: 0.23,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 560.00,
    unit: 'm2',
    description: 'Sloupové bednění PERI pro sloupy 20–60 cm (rastr 5 cm, tlak 80 kN/m²)',
    weight_kg_m2: 48,
    pressure_kn_m2: 80,
    max_panel_weight_kg: 120,
    needs_crane: true,
    formwork_category: 'column',
    pour_role: 'formwork',
    applicable_element_types: ['sloup', 'driky_piliru'],
  },
  {
    name: 'MULTIFLEX',
    manufacturer: 'PERI',
    heights: ['do 5.00'],
    assembly_h_m2: 0.50,
    disassembly_h_m2: 0.16,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 380.00,
    unit: 'm2',
    description: 'Flexibilní nosníkové stropní bednění PERI s GT 24 nosníky a VT 20 stojkami (do ~5 m, budovy)',
    weight_kg_m2: 20,
    max_assembly_height_m: 5,
    needs_crane: false,
    formwork_category: 'slab',
    // PERI ekvivalent Dokaflex — budovy, ne mostovka.
    pour_role: 'formwork_props',
    applicable_element_types: ['stropni_deska', 'zakladova_deska', 'pruvlak'],
  },
  {
    name: 'RUNDFLEX',
    manufacturer: 'PERI',
    heights: ['0.60', '1.20', '1.80', '2.40', '3.00', '3.60'],
    assembly_h_m2: 0.80,
    disassembly_h_m2: 0.24,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 620.00,
    unit: 'm2',
    description: 'Kruhové stěnové bednění PERI (R ≥ 1,0 m, tlak 60 kN/m², nádrže, sila, rampy)',
    weight_kg_m2: 45,
    pressure_kn_m2: 60,
    needs_crane: true,
    min_radius_m: 1.0,
    formwork_category: 'special',
    pour_role: 'formwork',
    applicable_element_types: ['nadrz'],
  },
  {
    name: 'SRS',
    manufacturer: 'PERI',
    heights: ['1.20', '2.40', '3.00', '6.00', '8.40'],
    assembly_h_m2: 0.85,
    disassembly_h_m2: 0.27,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 650.00,
    unit: 'm2',
    description: 'Kruhové sloupové bednění PERI (Ø 25–70 cm, ocelové panely, architektonický beton)',
    weight_kg_m2: 70,
    pressure_kn_m2: 80,
    needs_crane: true,
    min_radius_m: 0.125,
    formwork_category: 'column',
    pour_role: 'formwork',
    applicable_element_types: ['sloup'],
  },
  {
    name: 'VARIOKIT',
    manufacturer: 'PERI',
    heights: ['libovolná'],
    assembly_h_m2: 1.00,
    disassembly_h_m2: 0.35,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 850.00,
    unit: 'm2',
    description: 'Inženýrská stavebnice PERI pro mosty a tunely (VGK, VGB, VST moduly) — PERI ekvivalent nosníkové skruže Top 50',
    weight_kg_m2: 80,
    needs_crane: true,
    formwork_category: 'special',
    // PERI skruž pro mosty — engine ji párová s PERI stojkami (VST / UP Rosett).
    pour_role: 'falsework',
    applicable_element_types: ['mostovkova_deska', 'rigel'],
  },
  {
    name: 'CB 240',
    manufacturer: 'PERI',
    heights: ['3.00', '4.50'],
    assembly_h_m2: 0.95,
    disassembly_h_m2: 0.30,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 680.00,
    unit: 'm2',
    description: 'Šplhací konzola PERI pro jednostranné bednění (nosnost 240 kN)',
    weight_kg_m2: 75,
    needs_crane: true,
    formwork_category: 'special',
    pour_role: 'formwork',
  },
  // ── ULMA ─────────────────────────────────────────────────────────────
  {
    name: 'MEGALITE',
    manufacturer: 'ULMA',
    heights: ['2.70', '3.00', '3.30'],
    assembly_h_m2: 0.48,
    disassembly_h_m2: 0.14,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 490.00,
    unit: 'm2',
    description: 'Velkoformátové stěnové bednění ULMA — lehká konstrukce',
    weight_kg_m2: 38,
    pressure_kn_m2: 80,
    needs_crane: true,
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'COMAIN',
    manufacturer: 'ULMA',
    heights: ['1.00', '1.50', '2.00', '2.50'],
    assembly_h_m2: 0.68,
    disassembly_h_m2: 0.22,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 460.00,
    unit: 'm2',
    description: 'Rámové bednění ULMA pro základy, opěrné zdi',
    weight_kg_m2: 32,
    pressure_kn_m2: 60,
    max_panel_weight_kg: 60,
    needs_crane: false,
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  {
    name: 'CC-4',
    manufacturer: 'ULMA',
    heights: ['do 6.00'],
    assembly_h_m2: 0.42,
    disassembly_h_m2: 0.13,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 370.00,
    unit: 'm2',
    description: 'Stropní bednění ULMA s hliníkovými nosníky a stojkami (do ~6 m, budovy)',
    weight_kg_m2: 16,
    max_assembly_height_m: 6,
    needs_crane: false,
    formwork_category: 'slab',
    // ULMA ekvivalent Dokaflex — budovy, ne mostovka.
    pour_role: 'formwork_props',
    applicable_element_types: ['stropni_deska', 'zakladova_deska'],
  },
  // ── NOE ──────────────────────────────────────────────────────────────
  {
    name: 'NOEtop',
    manufacturer: 'NOE',
    heights: ['2.70', '3.00', '3.30'],
    assembly_h_m2: 0.52,
    disassembly_h_m2: 0.16,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 470.00,
    unit: 'm2',
    description: 'Rámové stěnové bednění NOE — jednoduché spínání',
    weight_kg_m2: 46,
    pressure_kn_m2: 60,
    needs_crane: true,
    formwork_category: 'wall',
    pour_role: 'formwork',
  },
  // ── Místní ───────────────────────────────────────────────────────────
  {
    name: 'Tradiční tesařské',
    manufacturer: 'Místní',
    heights: ['libovolná'],
    assembly_h_m2: 1.30,
    disassembly_h_m2: 0.65,
    disassembly_ratio: 0.50,
    rental_czk_m2_month: 0,
    unit: 'm2',
    description: 'Jednorázové tesařské bednění (bez pronájmu, materiál)',
    weight_kg_m2: 35,
    needs_crane: false,
    formwork_category: 'universal',
    pour_role: 'formwork',
  },
  // ── MSS — Movable Scaffolding Systems (2026-04-17) ───────────────────
  // Posuvná skruž. Vše integrováno v rámu: bednění + nosníky + stojky.
  // Pronájem komponent separátně = 0 (bundled v MSS mobilization +
  // monthly rental). Per-tact labor = base × mss_reuse_factor (0.35) —
  // forma se přesune, nestaví od nuly. MSS-specific costs jsou
  // spočítány v bridge-technology.ts calculateMSSCost() / Schedule();
  // tento katalog slouží pro selector + UI card sentinel.
  {
    name: 'DOKA MSS',
    manufacturer: 'DOKA',
    heights: ['libovolná'],
    // Nhod představují plnou montáž MSS přepočtenou na NK. Per-tact se
    // krátí faktorem 0.35 v orchestratoru.
    assembly_h_m2: 1.20,
    disassembly_h_m2: 0.60,
    disassembly_ratio: 0.50,
    // Pronájem je v MSS mobilization/rental modelu (bridge-technology),
    // ne per m² — v tomto poli 0 aby nic nedvojnásobilo náklady.
    rental_czk_m2_month: 0,
    unit: 'm2',
    description: 'DOKA MSS (Movable Scaffolding System) — posuvná skruž pro mosty velkých rozpětí, integruje bednění + nosníky + stojky v jednom rámu',
    needs_crane: true,
    formwork_category: 'special',
    pour_role: 'mss_integrated',
    applicable_element_types: ['mostovkova_deska', 'rigel'],
    mss_reuse_factor: 0.35,
  },
  {
    name: 'VARIOKIT Mobile',
    manufacturer: 'PERI',
    heights: ['libovolná'],
    assembly_h_m2: 1.25,
    disassembly_h_m2: 0.60,
    disassembly_ratio: 0.48,
    rental_czk_m2_month: 0,
    unit: 'm2',
    description: 'PERI VARIOKIT Mobile — posuvná skruž PERI, integrované bednění + skruž + stojky; ekvivalent DOKA MSS',
    needs_crane: true,
    formwork_category: 'special',
    pour_role: 'mss_integrated',
    applicable_element_types: ['mostovkova_deska', 'rigel'],
    mss_reuse_factor: 0.35,
  },
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
