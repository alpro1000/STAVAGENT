/**
 * Position Linking by OTSKP/URS Code Prefix v1.0
 *
 * Links related positions (beton + bednění + výztuž + předpětí) by their
 * catalog code prefix. The first 4 digits of OTSKP/URS codes identify the
 * construction element; the 5th digit identifies the work type.
 *
 * OTSKP (bridges): 6 digits, d5: 1-3=beton, 6=výztuž, 7=předpětí
 * URS (buildings): 9 digits, d5: 2=beton, 5=bednění, 6=výztuž
 *
 * Reference: OTSKP catalog (17,904 entries), URS classification system.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type CatalogType = 'otskp' | 'urs' | 'unknown';

export type WorkType = 'beton' | 'bednění' | 'bednění_zřízení' | 'bednění_odstranění' | 'výztuž' | 'předpětí' | 'unknown';

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

// ─── Catalog Detection ──────────────────────────────────────────────────────

/**
 * Detect catalog type from code format.
 * OTSKP: 6 digits. URS: 9 digits.
 */
export function detectCatalog(code: string): CatalogType {
  if (!code) return 'unknown';
  const clean = code.replace(/\s/g, '');
  if (/^\d{6}$/.test(clean)) return 'otskp';
  if (/^\d{9}$/.test(clean)) return 'urs';
  return 'unknown';
}

/**
 * Get code prefix (first 4 digits) that identifies the construction element.
 */
export function getCodePrefix(code: string): string | null {
  if (!code) return null;
  const clean = code.replace(/\s/g, '');
  if (clean.length >= 4 && /^\d{4}/.test(clean)) return clean.slice(0, 4);
  return null;
}

// ─── Work Type Detection ────────────────────────────────────────────────────

/**
 * Detect work type from the 5th digit of the code.
 */
export function detectWorkType(code: string): WorkType {
  const catalog = detectCatalog(code);
  const clean = code.replace(/\s/g, '');
  if (clean.length < 5) return 'unknown';

  const d5 = clean[4];

  if (catalog === 'otskp') {
    if (d5 === '1' || d5 === '2' || d5 === '3') return 'beton';
    if (d5 === '6') return 'výztuž';
    if (d5 === '7') return 'předpětí';
    return 'unknown';
  }

  if (catalog === 'urs') {
    if (d5 === '2') return 'beton';
    if (d5 === '5') {
      // URS bednění: suffix ...1121 = zřízení, ...1122 = odstranění
      if (clean.endsWith('1122') || clean.endsWith('122')) return 'bednění_odstranění';
      if (clean.endsWith('1121') || clean.endsWith('121')) return 'bednění_zřízení';
      return 'bednění';
    }
    if (d5 === '6') return 'výztuž';
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Map work type to Monolit subtype for display.
 */
export function workTypeToSubtype(wt: WorkType): string {
  switch (wt) {
    case 'beton': return 'beton';
    case 'bednění': case 'bednění_zřízení': return 'bednění';
    case 'bednění_odstranění': return 'odbednění';
    case 'výztuž': return 'výztuž';
    case 'předpětí': return 'předpětí';
    default: return 'jiné';
  }
}

// ─── Position Linking ───────────────────────────────────────────────────────

interface PositionMinimal {
  id: string;
  otskp_code?: string;
  item_name?: string;
  part_name?: string;
  subtype: string;
  unit: string;
  qty: number;
}

/**
 * Find related positions by code prefix.
 * Groups positions where the first 4 digits match.
 */
export function findLinkedPositions(
  currentCode: string,
  allPositions: PositionMinimal[],
): PositionGroup {
  const prefix = getCodePrefix(currentCode);
  const catalog = detectCatalog(currentCode);

  if (!prefix) {
    return { prefix: '', catalog: 'unknown', main: null, related: [], all: [] };
  }

  const linked: LinkedPosition[] = [];
  let main: LinkedPosition | null = null;

  for (const pos of allPositions) {
    if (!pos.otskp_code) continue;
    const posPrefix = getCodePrefix(pos.otskp_code);
    if (posPrefix !== prefix) continue;

    const wt = detectWorkType(pos.otskp_code);
    const lp: LinkedPosition = {
      id: pos.id,
      code: pos.otskp_code,
      work_type: wt,
      name: pos.item_name || pos.part_name || '',
      unit: pos.unit,
      qty: pos.qty,
      subtype: pos.subtype,
    };

    if (wt === 'beton') {
      main = lp;
    } else {
      linked.push(lp);
    }
  }

  return {
    prefix,
    catalog,
    main,
    related: linked,
    all: main ? [main, ...linked] : linked,
  };
}

/**
 * Fallback: detect work type from position name (when no OTSKP/URS code).
 */
export function detectWorkTypeFromName(name: string): WorkType {
  if (!name) return 'unknown';
  const lower = name.toLowerCase();

  if (/předpětí|předpínání|předpínac|y1860/.test(lower)) return 'předpětí';
  if (/odstran.*bedn|odbedň|demontáž.*bedn/.test(lower)) return 'bednění_odstranění';
  if (/zřízen.*bedn|montáž.*bedn|bednění|bedneni/.test(lower)) return 'bednění_zřízení';
  if (/výztuž|armování|armatura|ocel\s*b500|kari\s*síť/.test(lower)) return 'výztuž';
  if (/beton|železobet|prostý\s*bet/.test(lower)) return 'beton';

  return 'unknown';
}
