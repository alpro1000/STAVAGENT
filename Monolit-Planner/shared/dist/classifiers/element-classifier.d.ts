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
import type { PourMethod, FormworkFilterResult, ConcreteConsistency } from '../calculators/lateral-pressure.js';
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
/**
 * Extract metadata from OTSKP element name.
 * Detects concrete class, prestress, and material type.
 */
export declare function extractOtskpMetadata(name: string): {
    concrete_class?: string;
    is_prestressed?: boolean;
    is_prefab?: boolean;
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
export declare function recommendFormwork(type: StructuralElementType, height_m?: number, pour_method?: PourMethod, total_length_m?: number, concrete_consistency?: ConcreteConsistency): FormworkSystemSpec;
/**
 * Get pressure-filtered formwork systems for an element type.
 * Returns the full filter result (suitable, rejected, pressure).
 * Used by orchestrator for warnings and UI display.
 */
export declare function getFilteredFormworkSystems(type: StructuralElementType, height_m: number, pour_method?: PourMethod, concrete_consistency?: ConcreteConsistency): FormworkFilterResult & {
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
export declare const REQUIRED_FIELDS: Record<StructuralElementType, RequiredFieldSpec[]>;
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
}
export declare const SANITY_RANGES: Record<StructuralElementType, SanityRanges>;
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
export declare function checkSanity(elementType: StructuralElementType, values: Partial<Record<keyof SanityRanges, number>>): SanityIssue[];
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
