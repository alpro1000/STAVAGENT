/**
 * Construction Sequence — canonical ordering for bridge and building elements.
 *
 * Bridge: pilota → základy → pilíře → opěry → mostovka → přechodová deska → římsa → závěrné zídky
 * Building: pilota → základy → stěny/sloupy → stropy → schodiště → střecha
 *
 * Used by: PositionsTable (sort), ProjectGantt (sequence), Gantt dependencies.
 */
import type { StructuralElementType } from '../calculators/pour-decision.js';
/**
 * Canonical bridge construction order.
 * Lower number = built first (foundations → superstructure → finishing).
 */
export declare const BRIDGE_ELEMENT_ORDER: Record<StructuralElementType, number>;
/**
 * Canonical building construction order.
 * Lower number = built first (foundations → frame → floors → finishing).
 */
export declare const BUILDING_ELEMENT_ORDER: Record<StructuralElementType, number>;
/**
 * Bridge part name sequence (Czech KROS/ÚRS naming convention).
 * Used for fuzzy-matching part_name strings to construction order.
 */
export declare const BRIDGE_PART_SEQUENCE: readonly ["PILOTY", "ZÁKLADY", "ZÁKLADY PILÍŘŮ", "DŘÍKY PILÍŘŮ", "PILÍŘE", "STATIVA", "OPĚRY", "ÚLOŽNÉ PRAHY", "OPĚRNÉ ZDI", "PŘÍČNÍKY", "PŘÍČNÍK", "HLAVICE", "MOSTOVKA", "MOSTOVKOVÁ DESKA", "NOSNÁ KONSTRUKCE", "PŘECHODOVÉ DESKY", "PŘECHODOVÁ DESKA", "ŘÍMSY", "ŘÍMSOVÁ DESKA", "ZÁBRADELNÍ", "ZÁVĚRNÉ ZÍDKY", "IZOLACE", "VOZOVKA", "SVODIDLA", "ZÁBRADLÍ"];
/**
 * Building part name sequence.
 */
export declare const BUILDING_PART_SEQUENCE: readonly ["ZEMNÍ PRÁCE", "PILOTY", "ZÁKLADY", "ZÁKLADOVÁ DESKA", "ZÁKLADOVÝ PAS", "PODZEMNÍ STĚNY", "STĚNY", "SLOUPY", "JÁDRO", "PRŮVLAKY", "STROPNÍ DESKA", "STROP", "SCHODIŠTĚ", "STŘECHA", "IZOLACE", "FASÁDA"];
/**
 * Find the sequence index of a part name in a sequence array.
 * Uses fuzzy substring matching (normalized, case-insensitive).
 *
 * @returns index in sequence (lower = earlier), or 999 for unmatched parts
 */
export declare function getPartSequenceIndex(partName: string, sequence: readonly string[]): number;
/**
 * Detect if a set of part names is more likely a bridge or building project.
 * Returns the appropriate sequence array.
 */
export declare function detectProjectSequence(partNames: string[]): readonly string[];
/**
 * Sort part names by construction sequence.
 * Bridge parts sorted by BRIDGE_PART_SEQUENCE, building by BUILDING_PART_SEQUENCE.
 * Auto-detects project type from part names.
 */
export declare function sortPartsBySequence(partNames: string[]): string[];
