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
import type { PourMethod, FormworkFilterResult } from '../calculators/lateral-pressure.js';
export interface ElementProfile {
    /** Classified element type */
    element_type: StructuralElementType;
    /** Czech label */
    label_cs: string;
    /** Confidence of classification (0–1) */
    confidence: number;
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
    /** Typical reinforcement ratio kg/m³ (midpoint) */
    rebar_ratio_kg_m3: number;
    /** Min–max rebar ratio range */
    rebar_ratio_range: [number, number];
    /** Rebar labor norm (h/t) — element-specific */
    rebar_norm_h_per_t: number;
    /** Required strip strength as % of f_ck */
    strip_strength_pct: number;
    /** Element orientation for curing model: vertical strips faster */
    orientation: 'horizontal' | 'vertical';
    /** Typical pour rate constraint (m³/h) — element-specific limit */
    max_pour_rate_m3_h: number;
    /** Whether pump is typically needed */
    pump_typical: boolean;
}
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
export declare function classifyElement(name: string, context?: ClassificationContext): ElementProfile;
/**
 * Get element profile by known type (no classification needed).
 */
export declare function getElementProfile(type: StructuralElementType): ElementProfile;
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
export declare function recommendFormwork(type: StructuralElementType, height_m?: number, pour_method?: PourMethod, total_length_m?: number): FormworkSystemSpec;
/**
 * Get pressure-filtered formwork systems for an element type.
 * Returns the full filter result (suitable, rejected, pressure).
 * Used by orchestrator for warnings and UI display.
 */
export declare function getFilteredFormworkSystems(type: StructuralElementType, height_m: number, pour_method?: PourMethod): FormworkFilterResult & {
    pour_method: PourMethod;
    pressure_formula: string;
};
/**
 * Get adjusted assembly norm for element + formwork system combination.
 *
 * adjusted_norm = base_norm × difficulty_factor
 */
export declare function getAdjustedAssemblyNorm(elementType: StructuralElementType, formworkSystem: FormworkSystemSpec): {
    assembly_h_m2: number;
    disassembly_h_m2: number;
    difficulty_factor: number;
};
/**
 * Get formwork systems suitable for a given element type.
 * Combines: (1) explicitly recommended systems + (2) all systems of compatible category.
 * Returns { recommended, compatible, all } with deduplication.
 */
export declare function getSuitableSystemsForElement(elementType: StructuralElementType): {
    recommended: FormworkSystemSpec[];
    compatible: FormworkSystemSpec[];
    all: FormworkSystemSpec[];
};
export declare function estimateRebarMass(elementType: StructuralElementType, volume_m3: number): {
    estimated_kg: number;
    min_kg: number;
    max_kg: number;
    ratio_kg_m3: number;
};
/**
 * Get all element types with their Czech labels.
 */
export declare function getAllElementTypes(): Array<{
    type: StructuralElementType;
    label_cs: string;
}>;
