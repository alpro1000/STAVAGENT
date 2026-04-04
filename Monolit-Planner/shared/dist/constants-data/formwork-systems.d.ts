/**
 * Formwork Systems Catalog — Single Source of Truth
 *
 * Canonical data for all formwork systems used across backend and frontend.
 * Sources: DOKA price lists 2024, B3_current_prices, industry standards.
 *
 * Import this instead of maintaining separate copies in frontend/backend.
 */
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
    /** Panel weight (kg/m²) — affects crane requirement and handling */
    weight_kg_m2?: number;
    /** Max fresh concrete pressure (kN/m²) — determines pour rate limit */
    pressure_kn_m2?: number;
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
    /** Formwork category: wall, slab, column, special, universal */
    formwork_category?: 'wall' | 'slab' | 'column' | 'special' | 'universal';
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
export declare const FORMWORK_SYSTEMS: FormworkSystemSpec[];
/** Find a formwork system by name */
export declare function findFormworkSystem(name: string): FormworkSystemSpec | undefined;
/** Get default formwork system (Frami Xlife) */
export declare function getDefaultFormworkSystem(): FormworkSystemSpec;
/** Filter systems that don't require crane (manual handling only) */
export declare function getManualFormworkSystems(): FormworkSystemSpec[];
/** Filter systems by maximum concrete pressure (kN/m²) */
export declare function getSystemsByMinPressure(minPressure: number): FormworkSystemSpec[];
