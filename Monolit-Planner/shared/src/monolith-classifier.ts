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

/**
 * Concrete grade (marka betonu) — the STRONG positive signal (ADR-007).
 * Covers C30/37, C 30 / 37, LC25/28 (lightweight) and UHPC single-number
 * grades C110–C170. Applied to normalized (lowercased, accent-free) text.
 * Ported from the Excel extractor's grade-search so both import paths read
 * the same marka.
 */
export const CONCRETE_GRADE_RE = /[lc]?\s*c\s*\d{1,3}\s*\/\s*\d{1,3}|\bc\s*1[1-7]0\b/;

/**
 * Prefabricated-element veto — beats EVERYTHING except the user override,
 * including a present marka: «PATKY Z DÍLCŮ C25/30» quotes the precast
 * part's material but is NOT poured on site (ADR-007 §1).
 * `prefa` covers prefab/prefabrikát/prefy; `\bdil\w{0,3}\b` covers the
 * standalone díl forms (díl/dílu/díly/dílec/dílce/dílců) while deliberately
 * NOT matching `dilatacni`/`dilatace` (word longer than dil+3) — dilatation
 * joints are everywhere in bridge BOQs and must never be prefab-vetoed.
 */
export const PREFAB_RE = /prefa|\bdil\w{0,3}\b/;

/** Sub-work text signals (normalized text) — a row that names výztuž or
 *  bednění work is that SUB-WORK, never the concrete row itself, even when
 *  it quotes the parent's grade («ZÁKLADY … C25/30 — VÝZTUŽ B500B»). */
const REBAR_TEXT_RE = /vyztuz|\bocel\b|ocelov|b\s*500|bst\s*500|armatur|armokos/;
const FORMWORK_TEXT_RE = /bedn|odbedn|obednov/;

/**
 * Inclusion mentions — «… VČETNĚ BEDNĚNÍ», «vč. výztuže», «zahrnuje bednění»,
 * «s bedněním» — describe what the row's PRICE includes; they must NOT
 * reclassify a beton row as its own sub-work (OTSKP beton rows carry these
 * literally). Stripped before the sub-work text check; the grouping layer
 * reads the same mentions to set formwork_included / rebar_included.
 * Applied to normalized text; allows up to two words between the preposition
 * and the noun («se ztraceným bedněním»).
 */
export const INCLUSION_MENTION_RE =
  /(?:vcetne|vc\.?|zahrnuje|s|se)\s+(?:\w+\s+){0,2}?(?:bednenim?\w*|vyztuz\w*)(?:\s*(?:a|,|\+)\s*(?:bednenim?\w*|vyztuz\w*))*/g;

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
  /** Optional unit (m3/m2/t/kg/…) — TIE-BREAK ONLY, never classifies alone
   *  (ADR-007; m³ proved a weak signal live — #1470). Additive field, all
   *  pre-existing callers keep working without it. */
  unit?: string | null;
}

export type MonolithSubRole = 'beton' | 'bednění' | 'výztuž' | 'jiné';

export type MonolithSignal =
  | 'override'
  | 'rebar_text'
  | 'formwork_text'
  | 'prefab_veto'
  | 'aggregate'
  | 'marka'
  | 'code_monolithic'
  | 'code_non_monolithic'
  | 'podkladni_beton_451'
  | 'm3_concrete_keyword'
  | 'fallback';

/** Structured classification result (ADR-007). `signals` lists everything
 *  detected in ladder order; `decided_by` names the one that decided. */
export interface MonolithClassification {
  is_monolith: boolean;
  is_prefab: boolean;
  sub_role: MonolithSubRole;
  confidence: number;
  decided_by: MonolithSignal;
  signals: MonolithSignal[];
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

/** Normalize a unit string for tie-breaks: `M3`/`m³`/`m 3` → `m3`, `m²` → `m2`
 *  (inner whitespace stripped — the Excel extractor met `m 3` in the wild). */
function normalizeUnit(unit: MonolithCandidate['unit']): string {
  if (!unit) return '';
  return String(unit).toLowerCase().replace(/³/g, '3').replace(/²/g, '2').replace(/\s+/g, '');
}

/** Unit-only tie-break for the sub-role — never decides is_monolith. */
function subRoleFromUnit(unitNorm: string, isMonolith: boolean): MonolithSubRole {
  if (unitNorm === 'm3') return isMonolith ? 'beton' : 'jiné';
  if (unitNorm === 'm2') return 'bednění';
  if (unitNorm === 't' || unitNorm === 'kg') return 'výztuž';
  return isMonolith ? 'beton' : 'jiné';
}

/**
 * Classify a single budget row per the ADR-007 signal ladder:
 *
 *   override → sub-work text (výztuž/bednění) → prefab veto (beats marka!)
 *   → aggregate-without-concrete-signal → marka betonu (~0.95)
 *   → OTSKP code (mono ~0.9 / non-mono hard, with the §451x prostý-beton
 *     exception ~0.75) → m³+concrete-keyword weak signal (~0.6)
 *   → fallback true (~0.3 — no signal at all must not hide WIP rows).
 *
 * The unit NEVER classifies on its own — it only tie-breaks the sub-role.
 * One implementation for both import paths (Excel and Registry) — the three
 * divergent `determineSubtype` copies delegate here (Gate 4).
 */
export function classifyMonolithRow(pos: MonolithCandidate): MonolithClassification {
  const signals: MonolithSignal[] = [];
  const text = normalize(pos.item_name);
  const code = cleanCode(pos.otskp_code);
  const unitNorm = normalizeUnit(pos.unit);

  const isPrefab = text ? PREFAB_RE.test(text) : false;
  if (isPrefab) signals.push('prefab_veto');
  const hasConcreteSignal = text ? CONCRETE_KEYWORDS.some(k => text.includes(k)) : false;
  const hasAggregateSignal = text ? AGGREGATE_KEYWORDS.some(k => text.includes(k)) : false;
  const hasMarka = text ? CONCRETE_GRADE_RE.test(text) : false;
  if (hasMarka) signals.push('marka');

  const done = (
    is_monolith: boolean,
    sub_role: MonolithSubRole,
    confidence: number,
    decided_by: MonolithSignal,
  ): MonolithClassification => {
    if (!signals.includes(decided_by)) signals.push(decided_by);
    return { is_monolith, is_prefab: isPrefab, sub_role, confidence, decided_by, signals };
  };

  // 1. Manual override always wins — both directions, absolute.
  const override = readMonolithOverride(pos.metadata);
  if (override !== null) {
    return done(override, override ? 'beton' : subRoleFromUnit(unitNorm, false), 1.0, 'override');
  }

  // 2. Sub-work text: a row NAMING výztuž/bednění work is that sub-work,
  //    never the concrete row — even when it quotes the parent's marka
  //    («ZÁKLADY … C25/30 — VÝZTUŽ B500B» must not become beton via marka).
  //    Inclusion mentions are stripped first: «ZÁKLADY … VČETNĚ BEDNĚNÍ» is
  //    a beton row whose price includes formwork, not a formwork row.
  const subworkText = text.replace(INCLUSION_MENTION_RE, ' ');
  if (subworkText && REBAR_TEXT_RE.test(subworkText)) {
    return done(false, 'výztuž', 0.9, 'rebar_text');
  }
  if (subworkText && FORMWORK_TEXT_RE.test(subworkText)) {
    return done(false, 'bednění', 0.9, 'formwork_text');
  }

  // 3. Prefab veto — beats a present marka (the grade describes the precast
  //    part's material, the element is not poured on site).
  if (isPrefab) {
    return done(false, 'jiné', 0.95, 'prefab_veto');
  }

  // 4. Aggregate-only text → not monolithic (kamenivo/štěrk/… even in m³).
  if (hasAggregateSignal && !hasConcreteSignal) {
    return done(false, subRoleFromUnit(unitNorm, false), 0.9, 'aggregate');
  }

  // 5. Marka betonu — strong positive.
  if (hasMarka) {
    return done(true, 'beton', 0.95, 'marka');
  }

  // 6. OTSKP code — when a code is present it DECIDES (pre-ADR-007
  //    contract preserved: a 6xxxx/9xxxx code never falls through to the
  //    weak signal or the fallback).
  if (code) {
    if (isNonMonolithicCode(code)) {
      // §451x exception (interview answer 2): «podkladní/prostý beton» rows
      // live under the podsypy prefix but ARE computable plain concrete —
      // only when the text actually says beton. Asphalt (564–569) and earth
      // works stay hard rejects even though «asfaltový beton» contains the
      // keyword.
      if (code.startsWith('45') && hasConcreteSignal) {
        return done(true, 'beton', 0.75, 'podkladni_beton_451');
      }
      return done(false, subRoleFromUnit(unitNorm, false), 0.9, 'code_non_monolithic');
    }
    return isMonolithicCodePrefix(code)
      ? done(true, 'beton', 0.9, 'code_monolithic')
      : done(false, subRoleFromUnit(unitNorm, false), 0.9, 'code_non_monolithic');
  }

  // 7. Weak signal: m³ + concrete keyword (no code, no marka) — catches
  //    «betonáž stěn … m³». m³ alone deliberately does NOT fire.
  if (unitNorm === 'm3' && hasConcreteSignal) {
    return done(true, 'beton', 0.6, 'm3_concrete_keyword');
  }

  // 8. No code, no clear signal → treat as monolithic so work-in-progress
  //    rows aren't hidden from the user (pre-existing contract; the frontend
  //    computable-gate #1470 handles visibility).
  return done(true, subRoleFromUnit(unitNorm, true), 0.3, 'fallback');
}

/**
 * Decide whether a single position (or element-level beton position) is a
 * monolithic concrete work. Backward-compatible boolean wrapper over
 * `classifyMonolithRow` — pre-ADR-007 callers keep working unchanged.
 */
export function isMonolithicElement(pos: MonolithCandidate): boolean {
  return classifyMonolithRow(pos).is_monolith;
}

/** Shared text/code helpers for sibling modules (grouping layer) — one
 *  normalization, not per-module copies. */
export { normalize as normalizeCzechText, cleanCode as cleanOtskpCode };

/** Re-export prefix sets so backend parsers can share the keyword lists
 *  without duplicating them. */
export const MONOLITH_CLASSIFIER_KEYWORDS = {
  AGGREGATE_KEYWORDS,
  CONCRETE_KEYWORDS,
  NON_MONOLITHIC_OTSKP_PREFIXES,
  MONOLITHIC_OTSKP_PREFIXES,
};
