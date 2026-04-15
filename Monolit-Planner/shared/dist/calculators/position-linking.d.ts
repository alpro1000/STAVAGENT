/**
 * Position Linking by OTSKP/URS Code Prefix v1.1
 *
 * Links related positions (beton + bednění + výztuž + předpětí + podpěry + zrání)
 * by their catalog code prefix. The first 4 digits of OTSKP/URS codes identify
 * the construction element; the 5th digit identifies the work type.
 *
 * OTSKP (bridges): 6 digits, d5: 1-3=beton, 6=výztuž, 7=předpětí
 * URS (buildings): 9 digits, d5: 2=beton, 5=bednění, 6=výztuž
 *
 * RTS / unknown: name-based fallback via detectWorkTypeFromName.
 *
 * Reference: OTSKP catalog (17,904 entries), URS classification system.
 */
export type CatalogType = 'otskp' | 'urs' | 'unknown';
export type WorkType = 'beton' | 'bednění' | 'bednění_zřízení' | 'bednění_odstranění' | 'výztuž' | 'předpětí' | 'podpěry' | 'zrání' | 'vrtání' | 'úprava_hlavy' | 'unknown';
export interface LinkedPosition {
    /** Position ID in Monolit DB */
    id: string;
    /** OTSKP/URS catalog code */
    code: string;
    /** Detected work type from code */
    work_type: WorkType;
    /** Position description */
    name: string;
    /** Unit (M3, m2, t, etc.) */
    unit: string;
    /** Quantity */
    qty: number;
    /** Subtype in Monolit (beton, bednění, výztuž, etc.) */
    subtype: string;
}
export interface PositionGroup {
    /** Code prefix (first 4 digits) */
    prefix: string;
    /** Catalog type */
    catalog: CatalogType;
    /** The concrete (beton) position — main element */
    main: LinkedPosition | null;
    /** Related positions (výztuž, bednění, předpětí) */
    related: LinkedPosition[];
    /** All positions in the group */
    all: LinkedPosition[];
}
/** TOV labor entry — one profession row */
export interface TOVLaborEntry {
    id: string;
    profession: string;
    professionCode: string;
    count: number;
    hours: number;
    normHours: number;
    hourlyRate: number;
    totalCost: number;
    note?: string;
    /**
     * Per-entry source flag (Aplikovat split refactor).
     * 'calculator' = added by Aplikovat — eligible for [×] delete in TOV.
     * 'manual'     = added by user manually or by import — preserved.
     * Undefined entries fall back to the parent TOVEntries.source for legacy data.
     */
    source?: 'calculator' | 'manual';
}
/** TOV material/rental entry */
export interface TOVMaterialEntry {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalCost: number;
    rentalMonths?: number;
    note?: string;
}
/** TOV data stored in position metadata */
export interface TOVEntries {
    labor: TOVLaborEntry[];
    materials: TOVMaterialEntry[];
    source: 'calculator' | 'manual';
    calculated_at: string;
}
/**
 * Detect catalog type from code format.
 * OTSKP: 6 digits. URS: 9 digits.
 */
export declare function detectCatalog(code: string): CatalogType;
/**
 * Get code prefix (first 4 digits) that identifies the construction element.
 */
export declare function getCodePrefix(code: string): string | null;
/**
 * Detect work type from the 5th digit of the code.
 */
export declare function detectWorkType(code: string): WorkType;
/**
 * Map work type to Monolit subtype for display.
 */
export declare function workTypeToSubtype(wt: WorkType): string;
interface PositionMinimal {
    id: string;
    otskp_code?: string;
    item_name?: string;
    part_name?: string;
    subtype: string;
    unit: string;
    qty: number;
    /** Used by findLinkedPositions to match siblings inside the same element block */
    bridge_id?: string;
}
/**
 * Find related positions by code prefix — with two fallbacks.
 *
 * Matching strategy (in priority order):
 *   1. Same OTSKP/URS code prefix (first 4 digits of `otskp_code`)
 *      → use detectWorkType(code); if it returns 'unknown', fall back to
 *        detectWorkTypeFromName(item_name|part_name).
 *   2. If `currentCode` has no recognizable prefix BUT the caller passed
 *      `currentPartName` + `currentBridgeId`, we treat all positions sharing
 *      that part_name+bridge_id as siblings (for RTS / no-code soupis).
 *      Work type is derived from each sibling's name.
 *
 * @param currentCode    OTSKP/URS code of the "main" position (may be empty for RTS)
 * @param allPositions   All positions in the project
 * @param ctx            Optional context for sibling-by-name matching
 */
export declare function findLinkedPositions(currentCode: string, allPositions: PositionMinimal[], ctx?: {
    currentPartName?: string;
    currentBridgeId?: string;
}): PositionGroup;
/**
 * Fallback: detect work type from position name (when no OTSKP/URS code).
 *
 * Used by findLinkedPositions when detectWorkType(code) returns 'unknown'
 * (e.g. RTS soupis, manually added positions, OTSKP positions with mistyped
 * codes). Patterns are diacritic-insensitive and match Czech + a couple of
 * common English / German equivalents.
 */
export declare function detectWorkTypeFromName(name: string): WorkType;
export {};
