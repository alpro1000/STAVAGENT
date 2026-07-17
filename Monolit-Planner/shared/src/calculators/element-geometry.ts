/**
 * element-geometry — Phase 5 Step 2: geometry → volume/area, in the SHARED
 * engine (Alexander's interview 2026-06-13).
 *
 * Recon #1352 problem 2: dimensions were derived only on the frontend, for
 * ~7 of 23 types, and the geometry length never fed the tact engine. This
 * module is the single source of the dimensions→quantity rule so the frontend,
 * the engine (`planElement`), and MCP all produce the SAME volume — closing
 * the §4 parity gap ("Core computes, front/MCP project").
 *
 * Decisions:
 *  - Expand the L×W×H box rule to ALL prismatic types (walls, slabs, columns,
 *    beams, foundations, abutments, piers, …).
 *  - honest-blank for genuinely non-prismatic types — the deck (complex
 *    cross-section; its volume comes from the VV, as the SO-202 goldens do),
 *    piles (own Ø formula, handled by the pile path), stairs, tanks, cornices
 *    (bm cross-section). These return `applicable: false` with a VISIBLE
 *    reason, never a fabricated box volume.
 */

/** Element types whose volume CANNOT be a simple L×W×H box → honest-blank. */
const NON_PRISMATIC_TYPES = new Set<string>([
  'mostovkova_deska', // complex deck cross-section — volume from VV, not geometry
  'pilota',           // π·r²·h — handled by the dedicated pile path, not a box
  'schodiste',        // stairs — stepped, not a prism
  'nadrz',            // tank — hollow
  'rimsa',            // cornice — bm cross-section, not a W×H box
  'uzavreny_ram_tubus', // closed frame — hollow; a solid box would fabricate
                        // ~3× the real concrete volume. Geometry lives in the
                        // explicit tubus_* inputs (§2.10), never in L×W×H.
  'other',            // unknown — never guess a box volume
]);

export interface ElementDims {
  length_m?: number;
  width_m?: number;
  height_m?: number;
}

export interface GeometryEstimate {
  /** False only for non-prismatic types → honest-blank with a visible reason. */
  applicable: boolean;
  /** L×W×H, present only when applicable AND all three dims > 0. */
  volume_m3?: number;
  /** Lateral box surface 2(L+W)·H — the same formula the frontend used. */
  formwork_area_m2?: number;
  /** Czech, user-facing message when !applicable (honest-blank, visible — not a silent 0). */
  reason?: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Volume + formwork-area estimate from box dimensions.
 *  - Non-prismatic type → `{ applicable: false, reason }` (honest-blank).
 *  - Prismatic type, incomplete dims → `{ applicable: true }` (no estimate yet,
 *    user still entering — NOT an error).
 *  - Prismatic type, all dims → volume = L·W·H, formwork = 2(L+W)·H.
 */
export function estimateElementVolume(
  elementType: string,
  dims: ElementDims,
): GeometryEstimate {
  if (NON_PRISMATIC_TYPES.has(elementType)) {
    return {
      applicable: false,
      reason: 'Geometrie (D×Š×V) nepodporována pro tento typ — zadejte objem ručně.',
    };
  }
  const L = dims.length_m, W = dims.width_m, H = dims.height_m;
  if (!L || !W || !H || L <= 0 || W <= 0 || H <= 0) {
    return { applicable: true };
  }
  return {
    applicable: true,
    volume_m3: round2(L * W * H),
    formwork_area_m2: round1(2 * (L + W) * H),
  };
}

/** True when the element's volume can be derived from L×W×H box dims. */
export function isPrismaticType(elementType: string): boolean {
  return !NON_PRISMATIC_TYPES.has(elementType);
}
