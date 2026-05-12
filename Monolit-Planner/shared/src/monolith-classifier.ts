/**
 * Shared monolith-vs-non-monolith classifier.
 *
 * Used by:
 *   • Frontend "Jen monolity" filter (FlatPositionsTable)
 *   • Backend export filter (?only_monoliths=true)
 *   • Backend XLSX/Registry parser (so kamenivo doesn't get subtype='beton')
 *
 * Decision order (first match wins):
 *   1. Per-element manual override stored on the beton position's metadata
 *      (`metadata.is_monolith_override = true | false`).
 *   2. Description text — aggregate-only rows ("výplň z kameniva drceného",
 *      "podkladní vrstvy z kameniva těženého", štěrk, písek, …) are NOT
 *      monolithic, even when the unit is m³ and the OTSKP code starts with 4.
 *   3. OTSKP code prefix — TSKP §27/28 (základy), §31–35 (svislé), §41–48
 *      (vodorovné betonové) are monolithic. §451–459 (podsypy / podkladní
 *      vrstvy z kameniva) and §11x/17x (zemní práce, skládka) are NOT.
 *   4. Fallback: if neither code nor text gives a signal, treat as monolithic
 *      (don't hide work-in-progress positions where the rozpočtář hasn't
 *      filled the OTSKP code yet).
 */

/** Aggregate / non-concrete material keywords (Czech, lowercased, accent-free
 *  comparison). If any of these appear in the description AND no concrete
 *  keyword is found → row is NOT monolithic concrete. */
const AGGREGATE_KEYWORDS = [
  'kameniv',     // kamenivo, z kameniva, kameniva drceneho/tezeneho
  'drcen',       // drcené kamenivo
  'tezen',       // těžené kamenivo
  'sterk',       // štěrk / štěrkodrť
  'sterkodrt',
  'sypanin',     // sypanina
  'pisek',       // písek
  'pisku',
  'piskov',
  'zemin',       // zemina, zemní výplň
  'recykl',      // recyklát (R-materiál)
  'prosevk',     // prosévka
  'mlat',        // mlat (vápencová drť)
  'sutov',       // sutě
  'asfalt',      // asfaltový beton — pozor, není to monolit
  'oblazk',      // oblázky
  'haldovin',
];

/** Concrete signals — if present, the row IS treated as concrete even if
 *  it also mentions aggregate ("železobetonová deska s výplní z kameniva"). */
const CONCRETE_KEYWORDS = [
  'beton',       // beton, železobeton (matches both via substring)
  'zelezobet',
  'monolit',
  'predpjat',    // předpjatý beton
  'zb ',         // ŽB konstrukce (with trailing space to avoid false matches)
  ' zb',
];

/** OTSKP prefixes that are explicitly NOT monolithic concrete even though
 *  they start with 1/2/3/4/5. Order: longest prefix first (we use startsWith). */
const NON_MONOLITHIC_OTSKP_PREFIXES = [
  '451', '452', '453', '454', '455', '456', '457', '458', '459', // podsypy / podkl. vrstvy
  '11',  // zemní práce
  '12',  // zemní práce — odkopávky, výkopy
  '13',  // hloubení, zabezpečení
  '14',  // zemní práce – odvodnění
  '15',  // zemní práce – ostatní
  '16',  // přesun zemin
  '17',  // skládky, deponie
  '18',  // úpravy podloží, povrchové úpravy
  '564', '565', '566', '567', '568', '569', // asfaltové vrstvy
  '57',  // kryty štěrkové, dlažební
  '58',  // dlažby
];

/** OTSKP prefixes that ARE monolithic concrete works. */
const MONOLITHIC_OTSKP_PREFIXES = ['2', '3', '4'];

// Combining diacritical marks U+0300 – U+036F (e.g. č → c + ̌).
const DIACRITIC_RE = /[̀-ͯ]/g;

function normalize(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase();
}

function cleanCode(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).replace(/\s/g, '').trim();
}

/** True iff the code is on the explicit non-monolithic prefix list. */
function isNonMonolithicCode(code: string): boolean {
  return NON_MONOLITHIC_OTSKP_PREFIXES.some(p => code.startsWith(p));
}

/** True iff the code starts with a monolithic prefix (and isn't on the
 *  non-monolithic exclusion list). */
function isMonolithicCodePrefix(code: string): boolean {
  if (!code) return false;
  if (isNonMonolithicCode(code)) return false;
  return MONOLITHIC_OTSKP_PREFIXES.some(p => code.startsWith(p));
}

export interface MonolithCandidate {
  /** Description / popis used for keyword matching. */
  item_name?: string | null;
  /** OTSKP/SR code. */
  otskp_code?: string | null;
  /** Optional metadata blob (parsed object or JSON string). May contain
   *  `is_monolith_override: boolean`. */
  metadata?: string | Record<string, unknown> | null;
}

/** Read the manual override from metadata, if any. */
export function readMonolithOverride(
  metadata: MonolithCandidate['metadata']
): boolean | null {
  if (!metadata) return null;
  let meta: Record<string, unknown> | null = null;
  if (typeof metadata === 'string') {
    try { meta = JSON.parse(metadata); } catch { return null; }
  } else if (typeof metadata === 'object') {
    meta = metadata as Record<string, unknown>;
  }
  if (!meta) return null;
  const v = meta.is_monolith_override;
  if (v === true || v === false) return v;
  return null;
}

/**
 * Decide whether a single position (or element-level beton position) is a
 * monolithic concrete work.
 */
export function isMonolithicElement(pos: MonolithCandidate): boolean {
  // 1. Manual override always wins.
  const override = readMonolithOverride(pos.metadata);
  if (override !== null) return override;

  const text = normalize(pos.item_name);
  const code = cleanCode(pos.otskp_code);

  // 2. Aggregate-only text → not monolithic.
  if (text) {
    const hasConcreteSignal = CONCRETE_KEYWORDS.some(k => text.includes(k));
    const hasAggregateSignal = AGGREGATE_KEYWORDS.some(k => text.includes(k));
    if (hasAggregateSignal && !hasConcreteSignal) return false;
  }

  // 3. OTSKP code check.
  if (code) {
    if (isNonMonolithicCode(code)) return false;
    return isMonolithicCodePrefix(code);
  }

  // 4. No code, no clear signal → treat as monolithic so work-in-progress
  //    rows aren't hidden from the user.
  return true;
}

/** Re-export prefix sets so backend parsers can share the keyword lists
 *  without duplicating them. */
export const MONOLITH_CLASSIFIER_KEYWORDS = {
  AGGREGATE_KEYWORDS,
  CONCRETE_KEYWORDS,
  NON_MONOLITHIC_OTSKP_PREFIXES,
  MONOLITHIC_OTSKP_PREFIXES,
};
