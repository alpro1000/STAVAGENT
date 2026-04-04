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
export declare const PROP_SYSTEMS: PropSystem[];
/** Default prop grid spacing by element type (m × m) */
export declare const PROP_GRID_DEFAULTS: Partial<Record<StructuralElementType, {
    grid_m: number;
    description: string;
}>>;
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
export declare const ELEMENT_DIMENSION_HINTS: Record<StructuralElementType, DimensionHint>;
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
/**
 * Select the best prop system for given height.
 * Prefers cheapest system that covers the height.
 */
export declare function selectPropSystem(height_m: number, override_name?: string): PropSystem;
export declare function calculateProps(input: PropsCalculatorInput): PropsCalculatorResult;
