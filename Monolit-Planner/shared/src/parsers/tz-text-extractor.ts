/**
 * TZ Text Extractor — regex-based parameter extraction from Czech TZ (technická zpráva) text.
 *
 * Extracts construction parameters from pasted/OCR'd TZ excerpts:
 *   - concrete_class, exposure_class, dimensions, spans, cables, etc.
 *   - confidence=1.0 for regex matches (deterministic)
 *   - smeta-line parser: OTSKP (6 digits) / ÚRS (9 digits) code + MJ + quantity
 *
 * Designed for:
 *   1. Calculator textarea "Vložit text z TZ" (Phase 3)
 *   2. SmartInput document bridge pipeline (future Phase 1)
 *   3. MCP tool parameter enrichment (future)
 *
 * All patterns tested against SO-202/203/207 golden test TZ excerpts
 * and the VP4 opěrná zeď smeta excerpt (2026-04-17 live bug).
 */

import {
  detectCatalog,
  detectWorkType,
  detectWorkTypeFromName,
  type CatalogType,
  type WorkType,
} from '../calculators/position-linking.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedParam {
  /** Parameter name matching FormState / PlannerInput field */
  name: string;
  /** Extracted value (string, number, boolean, or string[] for multi-value
   *  fields like `exposure_classes` — Task 2, 2026-04-20). */
  value: string | number | boolean | string[];
  /** Display label in Czech */
  label_cs: string;
  /** Source confidence: 1.0 for regex, 0.7-0.9 for heuristic */
  confidence: number;
  /**
   * Source:
   *   - 'regex'      — full regex match against TZ prose
   *   - 'keyword'    — substring keyword detection (element_type, prestressed, …)
   *   - 'heuristic'  — collapse of multi-match into a single primary
   *   - 'smeta_line' — parsed OTSKP/ÚRS code + qty + unit line
   *   - 'drawing'    — match originated inside a drawing transcript line
   *                    (ALL-CAPS prefix + TKP/ČSN parenthetical heuristic).
   *                    Lower trust than TZ prose because OCR noise is more
   *                    likely; the reconciliation rule in
   *                    `docs/audits/smartextractor_so250/2026-05-14_extractor_coverage.md`
   *                    §5.5 says "drawing wins on conflict but confidence
   *                    drops to 0.85 from the regex 1.0".
   */
  source: 'regex' | 'keyword' | 'heuristic' | 'smeta_line' | 'drawing';
  /** Original matched text snippet */
  matched_text: string;
  /**
   * Fix #1 (2026-05-14, SO-250 audit): which element the value belongs to
   * inside the source document. Filled when the line/sentence containing
   * the match has a recognized anchor keyword (podkladní beton / základ /
   * dřík / římsa / kotevní trám / zábradlí). The global flat
   * `concrete_class` / `exposure_classes` entries stay (backward compat
   * for existing consumers); scoped entries are emitted in addition.
   *
   * Consumer rule: when an UI knows the user's intent (e.g. they clicked
   * "fill from TZ" while editing the dřík row), pick the entry with
   * `element_scope === 'drik'`. When intent is unknown, fall back to the
   * unscoped primary.
   */
  element_scope?: 'podkladni_beton' | 'zaklad' | 'drik' | 'rimsa' | 'zabradli' | 'kotevni_tram' | 'face_cladding';
  /** Catalog type when value originated from a budget/smeta line */
  catalog?: CatalogType;
  /** OTSKP/URS code that produced this value (smeta_line source only) */
  code?: string;
  /**
   * Task 3 (2026-04-20): competing values found in the same TZ pass.
   * Populated when the extractor had to COLLAPSE multiple distinct matches
   * (e.g. both "C30/37" and "C40/50" appear in the text; primary is the
   * higher class, alternatives lists the rest). Consumer UI can surface a
   * conflict picker so the user resolves ambiguity explicitly.
   *
   * Empty / undefined when the extractor is confident there was only one
   * meaningful value.
   */
  alternatives?: (string | number)[];
}

/** A single parsed smeta/budget line: "<code> <description> <unit> <quantity>" */
export interface SmetaLine {
  /** OTSKP (6 digits) or URS (9 digits) code */
  code: string;
  /** Catalog type detected from the code format */
  catalog: CatalogType;
  /** Work type resolved from the code (d5 + suffix rules) */
  work_type: WorkType;
  /** Position description (everything between code and unit) */
  description: string;
  /** Normalized unit: 'm3' | 'm2' | 'm' | 'bm' | 't' | 'kg' | 'ks' */
  unit: string;
  /** Quantity parsed from Czech number format (comma decimal, space thousands) */
  quantity: number;
  /** Full original line as-is */
  raw_line: string;
}

export interface ExtractOptions {
  /** Current element type — enables smeta → form-field mapping */
  element_type?: string;
}

// ─── Normalize ──────────────────────────────────────────────────────────────

function norm(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Drawing-transcript detection (Fix #3, 2026-05-14) ─────────────────────

/**
 * Heuristic: is this line copy-pasted from a drawing/výkres legenda?
 *
 * Drawing legends in ŘSD / CZ-TKP projects are formatted distinctly from
 * TZ prose:
 *   - ALL-CAPS prefix names the element ("PODKLADNÍ BETON", "OPĚRNÁ ZEĎ DŘÍK")
 *   - parenthetical with TKP / ČSN / TP norm reference ("(CZ-TKP 18PK)")
 *   - dash-separated parameter chain ("-Cl 0,4-Dmax22-S3")
 *
 * The two strong signals together (≥ 60 % alphabetic-uppercase share AND a
 * TKP / ČSN / TP parenthetical) reliably distinguish drawing from prose.
 * Either signal alone is not enough — TZ tables sometimes include all-caps
 * headers, and prose can mention "dle ČSN 73 6133" without being a legenda.
 */
export function isDrawingLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 10) return false;
  const letters = trimmed.match(/[A-Za-zÁ-Žá-ž]/g) ?? [];
  if (letters.length === 0) return false;
  const upperLetters = trimmed.match(/[A-ZÁ-Ž]/g) ?? [];
  const capsRatio = upperLetters.length / letters.length;
  const hasNormRef = /\((?:CZ-)?TKP[\s-]?\d|ČSN[\s ]?\d|TP[\s ]?\d/i.test(trimmed);
  return capsRatio >= 0.6 && hasNormRef;
}

/**
 * Classify the full input as drawing-dominant when ≥ 60 % of its non-empty
 * lines are drawing legends. Used by `extractFromText` to flip the source
 * tag of regex/heuristic matches to `'drawing'` and reduce their confidence
 * to 0.85 (the conflict-ladder slot per audit §5.5). Per-line tagging is a
 * cleaner extension and is left as a follow-up; this whole-input switch
 * already unlocks Block D probe coverage which is the main user need.
 */
export function isDrawingDominant(text: string): boolean {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return false;
  const drawingLines = lines.filter(isDrawingLine).length;
  return drawingLines / lines.length >= 0.6;
}

// ─── Element-scope anchors (Fix #1, 2026-05-14) ────────────────────────────

/**
 * Anchor keywords for per-element scoping. Order matters: more specific
 * anchors (`podkladn`, `drik`, `rimsa`, `kotevni tram`, `zabradl`) are
 * tested before the generic `zaklad`, so a line like "Základy ze ŽB do
 * C25/30 pro podkladní beton tloušťky 0,15 m" snaps to `podkladni_beton`,
 * not to `zaklad`. The whole match operates on `norm()`-ed text so
 * diacritics don't matter.
 */
const ELEMENT_ANCHORS: Array<{
  re: RegExp;
  scope: NonNullable<ExtractedParam['element_scope']>;
}> = [
  { re: /\bpodkladn\w*\s+beton|podkladn\w*\s+vrstv/, scope: 'podkladni_beton' },
  // Follow-up to Fix #1 (2026-05-14, Block B dimension pack): face_cladding
  // wins over `drik` when the sentence mentions either the cladding act
  // ("obložen lomovým kamenem"), the cladding noun ("lícový obklad"), or
  // a typed cladding anchor ("kotvami R8"). The sentence "Dřík konstrukce
  // je na líci obložen lomovým kamenem tloušťky 0,30 m" carries BOTH
  // anchors but the 0,30 m thickness belongs to the kámen, not the dřík
  // — so we route to face_cladding first.
  { re: /\boblo[žz]en\w*|lomov\w+\s+kamen|licov\w+\s+obklad|kotv\w*\s+R\d/, scope: 'face_cladding' },
  { re: /\bdrik\b|\bdriku\b|\bdriky\b/,              scope: 'drik' },
  { re: /\brims\w*\b/,                               scope: 'rimsa' },
  { re: /\bkotevn\w*\s+tram\b/,                      scope: 'kotevni_tram' },
  { re: /\bzabradl\w*\b/,                            scope: 'zabradli' },
  // Generic "základ" must come LAST — many sentences mention "základ" in
  // passing ("zeď bude založena na podkladní beton") but the dominant
  // anchor there is podkladn, not zaklad.
  { re: /\bzaklad\w*\b/,                             scope: 'zaklad' },
];

/** Find the strongest element anchor in a normalized text segment. */
export function detectElementScope(
  normalized: string,
): NonNullable<ExtractedParam['element_scope']> | undefined {
  for (const { re, scope } of ELEMENT_ANCHORS) {
    if (re.test(normalized)) return scope;
  }
  return undefined;
}

// ─── Czech number parsing ───────────────────────────────────────────────────

/**
 * Parse a Czech-formatted number: comma=decimal, space=thousands separator.
 * Falls back to US/EU formats when mixed punctuation is present.
 *
 *   "94,231"      → 94.231    (Czech decimal)
 *   "547,400"     → 547.4     (Czech decimal — trailing zeros)
 *   "1 456,78"    → 1456.78   (space thousands + comma decimal)
 *   "1.456,78"    → 1456.78   (EU: period thousands, comma decimal)
 *   "1,456.78"    → 1456.78   (US: comma thousands, period decimal)
 *   "1,234,567"   → 1234567   (multiple commas → US thousands)
 *   "94.231"      → 94.231    (single period → decimal)
 */
export function parseCzechNumber(s: string): number {
  const cleaned = s.replace(/\s+/g, '');
  if (!cleaned) return NaN;

  const commas = (cleaned.match(/,/g) || []).length;
  const periods = (cleaned.match(/\./g) || []).length;

  if (commas === 0 && periods === 0) return parseFloat(cleaned);
  if (commas === 1 && periods === 0) return parseFloat(cleaned.replace(',', '.'));
  if (commas === 0 && periods === 1) return parseFloat(cleaned);
  if (commas > 1 && periods <= 1) return parseFloat(cleaned.replace(/,/g, ''));

  // Mixed: rightmost of comma/period is decimal
  const lastComma = cleaned.lastIndexOf(',');
  const lastPeriod = cleaned.lastIndexOf('.');
  if (lastComma > lastPeriod) {
    // Czech: period=thousands, comma=decimal
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // US: comma=thousands, period=decimal
  return parseFloat(cleaned.replace(/,/g, ''));
}

// ─── Smeta (budget) line parser ─────────────────────────────────────────────

/**
 * Regex for budget lines: "<6|9-digit code> <description> <unit> <quantity>".
 *
 * Captures:
 *   [1] code (6 = OTSKP, 9 = URS)
 *   [2] description (non-greedy, up to the unit)
 *   [3] unit — longest alternatives first; lookahead `(?=\s|$)` replaces `\b`
 *       because `\b` fails after Unicode superscripts (m², m³)
 *   [4] quantity — ONE numeric token; no internal whitespace so a trailing
 *       VV formula ("…5,654    94,231*0,06") doesn't get swallowed
 */
const SMETA_LINE_RE =
  /^[\t ]*(\d{6}|\d{9})[\t ]+([^\n]+?)[\t ]+(m3|m2|m²|m³|mb|bm|ks|kg|m|t)(?=[\s,;]|$)[\t ]+([0-9]+(?:[.,][0-9]+)?)/i;

/**
 * Regex for codeless budget lines: "<description> <quantity> <unit>".
 *
 * Real-world smeta copy-pastes often strip the OTSKP/URS code column, leaving
 * only description + quantity + unit. We fall back to `detectWorkTypeFromName`
 * to classify the line — if classification fails ('unknown'), the line is
 * rejected (safer than false positives from prose containing "1,5 m" etc.).
 *
 * Qty-before-unit is the standard Czech export order:
 *   "Bednění opěrných zdí a valů svislých i skloněných zřízení 547,400 m2"
 *   "Výztuž opěrných zdí a valů D 12 mm z betonářské oceli 10 505 - 5,654 t"
 *
 * Captures:
 *   [1] description (non-greedy, up to qty+unit pair)
 *   [2] quantity
 *   [3] unit
 */
const CODELESS_SMETA_LINE_RE =
  /^(.+?)\s+([0-9]+(?:[.,][0-9]+)?)\s*(m3|m2|m²|m³|mb|bm|ks|kg|m|t)(?=[\s,;]|$)/i;

/** Normalize unit tokens: 'm²' → 'm2', 'm³' → 'm3', case-insensitive. */
function normalizeUnit(raw: string): string {
  const u = raw.toLowerCase();
  if (u === 'm²') return 'm2';
  if (u === 'm³') return 'm3';
  return u;
}

/**
 * Extract all budget/smeta lines from a text blob.
 * Deterministic — regex only, confidence=1.0 for each line.
 * Order preserved (source order in document).
 *
 * Two passes per line:
 *   1. With-code: "<6|9-digit code> <desc> <unit> <qty>" (KROS/URS export format)
 *   2. Codeless:  "<desc> <qty> <unit>" — classified via `detectWorkTypeFromName`.
 *                 Rejected if work type is 'unknown' to avoid false positives.
 */
export function extractSmetaLines(text: string): SmetaLine[] {
  const lines: SmetaLine[] = [];
  if (!text) return lines;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line) continue;

    // Pass 1: with code (OTSKP 6-digit / URS 9-digit)
    const m1 = line.match(SMETA_LINE_RE);
    if (m1) {
      const code = m1[1];
      const description = m1[2].trim();
      const unit = normalizeUnit(m1[3]);
      const quantity = parseCzechNumber(m1[4]);
      if (!isFinite(quantity)) continue;
      lines.push({
        code,
        catalog: detectCatalog(code),
        work_type: detectWorkType(code),
        description,
        unit,
        quantity,
        raw_line: line.trim(),
      });
      continue;
    }

    // Pass 2: codeless (description + qty + unit, classify by description)
    const m2 = line.match(CODELESS_SMETA_LINE_RE);
    if (m2) {
      const description = m2[1].trim();
      const work_type = detectWorkTypeFromName(description);
      if (work_type === 'unknown') continue; // reject prose false positives
      const quantity = parseCzechNumber(m2[2]);
      if (!isFinite(quantity)) continue;
      const unit = normalizeUnit(m2[3]);
      lines.push({
        code: '',
        catalog: 'unknown',
        work_type,
        description,
        unit,
        quantity,
        raw_line: line.trim(),
      });
    }
  }
  return lines;
}

// ─── Smeta → form-field mapping ─────────────────────────────────────────────

type FieldMapping = {
  field: string;
  label: (v: number, code: string) => string;
  transform?: (v: number) => number;
};

/**
 * Map (work_type × unit) → FormState field.
 *
 * Universal mapping — works for most concrete elements. Pile is the only
 * element with its own volume/rebar pipeline; we still map volume_m3 for it
 * (it is consumed by the pile-specific derivation).
 */
function mapSmetaToField(
  wt: WorkType,
  unit: string,
  _elementType?: string,
): FieldMapping | null {
  if (wt === 'beton' && unit === 'm3') {
    return {
      field: 'volume_m3',
      label: (v) => `Objem betonu: ${v} m³`,
    };
  }
  if ((wt === 'bednění' || wt === 'bednění_zřízení') && unit === 'm2') {
    return {
      field: 'formwork_area_m2',
      label: (v) => `Plocha bednění: ${v} m²`,
    };
  }
  // 'výztuž' total mass — informational param (no direct FormState field yet;
  // user sees it as a hint, follow-up task wires to rebar_index_kg_m3 ratio)
  if (wt === 'výztuž' && unit === 't') {
    return {
      field: 'reinforcement_total_kg',
      label: (v) => `Hmotnost výztuže: ${Math.round(v)} kg (${(v / 1000).toFixed(3)} t)`,
      transform: (v) => v * 1000,
    };
  }
  if (wt === 'výztuž' && unit === 'kg') {
    return {
      field: 'reinforcement_total_kg',
      label: (v) => `Hmotnost výztuže: ${Math.round(v)} kg`,
    };
  }
  return null;
}

/**
 * Convert parsed smeta lines into ExtractedParam entries.
 * Deduplicates by field — first occurrence wins (source order).
 */
function smetaLinesToParams(
  lines: SmetaLine[],
  elementType?: string,
): ExtractedParam[] {
  const params: ExtractedParam[] = [];
  const seenFields = new Set<string>();
  for (const line of lines) {
    const mapping = mapSmetaToField(line.work_type, line.unit, elementType);
    if (!mapping) continue;
    if (seenFields.has(mapping.field)) continue;
    const value = mapping.transform ? mapping.transform(line.quantity) : line.quantity;
    params.push({
      name: mapping.field,
      value,
      label_cs: mapping.label(value, line.code),
      confidence: 1.0,
      source: 'smeta_line',
      matched_text: line.raw_line,
      catalog: line.catalog,
      code: line.code,
    });
    seenFields.add(mapping.field);
  }
  return params;
}

// ─── Pattern definitions ────────────────────────────────────────────────────

/**
 * Extract all matching parameters from a TZ text excerpt.
 *
 * Pipeline:
 *   1. Smeta-line parser (OTSKP/URS codes → volume, formwork area, rebar mass)
 *   2. Text regex (concrete class, exposure, spans, dimensions, …)
 *   3. Keyword detection (prestressed, element type, subtype, …)
 *   4. Merge: smeta_line (conf=1.0) wins over regex heuristic for the same field
 *
 * @param text    Pasted TZ / smeta excerpt
 * @param options optional — element_type hint for field mapping
 * @returns       ExtractedParam[] sorted by confidence (highest first)
 */
export function extractFromText(
  text: string,
  options: ExtractOptions = {},
): ExtractedParam[] {
  const results: ExtractedParam[] = [];
  const normalized = norm(text);

  // Fix #3 (2026-05-14, SO-250 audit): when the whole input looks like a
  // drawing-legenda block (ALL-CAPS prefix + TKP/ČSN/TP parenthetical on
  // ≥ 60 % of lines), tag downstream regex/heuristic matches with
  // `source: 'drawing'` and downgrade confidence to 0.85 — the conflict-
  // ladder slot from audit §5.5. The smeta-line + keyword extractor
  // branches keep their original sources because those don't fire on
  // drawing inputs in practice (no OTSKP codes, no Czech prose verbs).
  const drawingMode = isDrawingDominant(text);
  const regexSource: ExtractedParam['source'] = drawingMode ? 'drawing' : 'regex';
  const heuristicSource: ExtractedParam['source'] = drawingMode ? 'drawing' : 'heuristic';
  const regexConf = drawingMode ? 0.85 : 1.0;
  const heuristicConf = drawingMode ? 0.6 : 0.8;

  // ─── Smeta-line extraction (deterministic, catalog-aware) ────────────────
  const smetaLines = extractSmetaLines(text);
  const smetaParams = smetaLinesToParams(smetaLines, options.element_type);
  const smetaFieldNames = new Set(smetaParams.map((p) => p.name));
  results.push(...smetaParams);

  // 1. Concrete class: C12/15, C25/30, C35/45, etc.
  const concreteRe = /C(\d{2})\/(\d{2,3})/g;
  let m: RegExpExecArray | null;
  const concreteClasses = new Set<string>();
  while ((m = concreteRe.exec(text)) !== null) {
    concreteClasses.add(m[0]);
  }
  if (concreteClasses.size === 1) {
    const cls = [...concreteClasses][0];
    results.push({
      name: 'concrete_class', value: cls, label_cs: `Třída betonu: ${cls}`,
      confidence: regexConf, source: regexSource, matched_text: cls,
    });
  } else if (concreteClasses.size > 1) {
    // Multiple classes found — primary = highest (most likely NK).
    // Task 3 (2026-04-20): expose the remaining candidates as
    // `alternatives` so the consumer UI can render a conflict picker.
    const sorted = [...concreteClasses].sort((a, b) => {
      const na = parseInt(a.replace(/C(\d+)\/.*/, '$1'));
      const nb = parseInt(b.replace(/C(\d+)\/.*/, '$1'));
      return nb - na;
    });
    results.push({
      name: 'concrete_class', value: sorted[0],
      label_cs: `Třída betonu: ${sorted[0]} (nejvyšší z ${concreteClasses.size})`,
      confidence: heuristicConf, source: heuristicSource, matched_text: sorted.join(', '),
      alternatives: sorted.slice(1),
    });
  }

  // 2. Exposure classes — Task 2 (2026-04-20): find ALL occurrences and
  // emit `exposure_classes` (array, all distinct) + `exposure_class`
  // (singular, most-restrictive) for backward compatibility.
  //
  // Regex enumerates the 20 valid ČSN EN 206+A2 classes explicitly so we
  // don't over-match (old pattern /X[CDFAS][12345]?\d/ missed X0 entirely
  // and happily emitted nonsense like "XD9"). Word boundary via lookahead
  // to tolerate unicode / punctuation around the token.
  const exposureRe = /\bX(?:0|C[1-4]|D[1-3]|F[1-4]|A[1-3]|M[1-3]|S[1-3])\b/g;
  const exposures = new Set<string>();
  while ((m = exposureRe.exec(text)) !== null) {
    exposures.add(m[0]);
  }
  if (exposures.size > 0) {
    const all = [...exposures];
    // Most-restrictive rule: XF > XD/XS > XA > XM > XC > X0. Within a
    // category, the numeric suffix breaks ties (XF4 > XF2).
    const prefixRank: Record<string, number> = {
      XF: 60, XD: 50, XS: 50, XA: 40, XM: 30, XC: 20, X0: 0,
    };
    const rankOf = (c: string) => {
      if (c === 'X0') return prefixRank.X0;
      const pre = c.slice(0, 2);
      const digit = parseInt(c.slice(-1), 10);
      return (prefixRank[pre] ?? 0) + (Number.isNaN(digit) ? 0 : digit);
    };
    const sorted = [...all].sort((a, b) => rankOf(b) - rankOf(a));
    const primary = sorted[0];

    // Emit the full array — new API. Task 2 UI binds to this.
    results.push({
      name: 'exposure_classes', value: all,
      label_cs: `Třídy prostředí: ${all.join(', ')}`,
      confidence: regexConf, source: regexSource, matched_text: all.join(', '),
    });
    // Emit the singular — legacy API. Older code (advisor prompt, Task 1
    // compat map) reads this. When more than one class is present the
    // confidence drops to 0.8 since the single-string view is lossy.
    // Task 3 (2026-04-20): populate `alternatives` so Task 3's incremental-
    // mode UI can surface a conflict picker ("TZ contains XF2 AND XF4 —
    // choose one") instead of silently taking the strictest.
    results.push({
      name: 'exposure_class', value: primary,
      label_cs: exposures.size === 1
        ? `Třída prostředí: ${primary}`
        : `Třída prostředí: ${primary} (nejpřísnější z ${exposures.size}: ${sorted.join(', ')})`,
      confidence: exposures.size === 1 ? regexConf : heuristicConf,
      source: exposures.size === 1 ? regexSource : heuristicSource,
      matched_text: sorted.join(', '),
      alternatives: exposures.size > 1 ? sorted.slice(1) : undefined,
    });
  }

  // 2b. Per-element scoping (Fix #1, 2026-05-14, SO-250 audit).
  //
  // The flat `concrete_class` + `exposure_classes` entries above collapse
  // multi-element documents (Block D with 4 separate betonáže legendas,
  // Block B prose mentioning podkladní + base + dřík in one paragraph)
  // down to one "highest" pick — silently losing the per-element breakdown
  // a rozpočtář needs. This sweep emits ADDITIONAL scoped entries (the
  // flat primary stays for backward compat) so the consumer UI can ask
  // "what's the concrete class for the dřík specifically?" and get the
  // right answer.
  //
  // Block B dimension follow-up (2026-05-14): segments are walked in
  // document order; when a segment lacks its own anchor the scope from
  // the previous segment is INHERITED. This unblocks Block C where
  // "Šířka 0,85 m, tloušťka 0,4 m na líci a 0,36 m na rubu" follows the
  // "Římsy-kotevní trámy …" line and otherwise lacks an anchor of its
  // own. Per-segment thickness/width/range regex emit dimension fields
  // (`thickness_m`, `width_m`, `height_min_m`, `height_max_m`,
  // `thickness_face_m`, `thickness_back_m`) with the right element_scope.
  const seenScopeValue = new Set<string>(); // "name|scope|value"
  const segments: Array<{ raw: string; norm: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // Per-sentence split on period/semicolon — preserves order so a
    // following sentence can inherit scope from the previous one.
    const subs = line.split(/(?<=[.;])\s+/).filter((s) => s.trim().length > 0);
    if (subs.length > 1) {
      // Include both the parent line (so legenda-style single-line items
      // still get the scope) AND each sub-sentence in source order.
      segments.push({ raw: line, norm: norm(line) });
      for (const sub of subs) segments.push({ raw: sub, norm: norm(sub) });
    } else {
      segments.push({ raw: line, norm: norm(line) });
    }
  }
  let lastScope: NonNullable<ExtractedParam['element_scope']> | undefined;
  for (const seg of segments) {
    const detected = detectElementScope(seg.norm);
    const scope = detected ?? lastScope;
    if (detected) lastScope = detected;
    if (!scope) continue;
    const isSegDrawing = isDrawingLine(seg.raw);
    const segRegexSource: ExtractedParam['source'] = isSegDrawing ? 'drawing' : 'regex';
    const segRegexConf = isSegDrawing ? 0.85 : 1.0;
    const emit = (name: string, value: ExtractedParam['value'], label: string, matched: string) => {
      const key = `${name}|${scope}|${JSON.stringify(value)}`;
      if (seenScopeValue.has(key)) return;
      seenScopeValue.add(key);
      results.push({
        name, value, label_cs: label,
        confidence: segRegexConf, source: segRegexSource,
        matched_text: matched.trim(),
        element_scope: scope,
      });
    };
    // Concrete class in this segment. Allow optional whitespace between
    // "C" and the two digit-pairs ("C 30/37" — common in TZ prose) and
    // normalize to the canonical no-space form before emit so equality
    // checks (probe / consumer UI) work uniformly.
    const segConcreteMatches = [...seg.raw.matchAll(/C\s*(\d{2})\s*\/\s*(\d{2,3})/g)]
      .map((mm) => `C${mm[1]}/${mm[2]}`);
    if (segConcreteMatches.length > 0) {
      const cls = segConcreteMatches[0];
      emit('concrete_class', cls, `Třída betonu (${scope}): ${cls}`, seg.raw);
    }
    // Exposure classes in this segment.
    const segExposures = [...seg.raw.matchAll(/\bX(?:0|C[1-4]|D[1-3]|F[1-4]|A[1-3]|M[1-3]|S[1-3])\b/g)].map((mm) => mm[0]);
    if (segExposures.length > 0) {
      const uniq = [...new Set(segExposures)];
      emit('exposure_classes', uniq, `Třídy prostředí (${scope}): ${uniq.join(', ')}`, seg.raw);
    }
    // ── Block B dimension pack (per-segment) ──
    //
    // Rímsa face+back thickness is a 2-value compound: "tloušťka 0,4 m
    // na líci a 0,36 m na rubu". Detect that pattern first and emit
    // BOTH thickness_face_m + thickness_back_m; skip the generic
    // single-value pattern for the same segment so we don't double-emit
    // the first value as `thickness_m`.
    const rimsaTwoSidedMatch = seg.raw.match(
      /tlou[šs][ťt]k\w*\s+(\d+[,.]\d+)\s*m\s+na\s+l[íi]ci(?:\s+a\s+|\s*,\s*)(\d+[,.]\d+)\s*m\s+na\s+rubu/i,
    );
    if (rimsaTwoSidedMatch) {
      const tFace = parseFloat(rimsaTwoSidedMatch[1].replace(',', '.'));
      const tBack = parseFloat(rimsaTwoSidedMatch[2].replace(',', '.'));
      emit('thickness_face_m', tFace, `Tloušťka líce (${scope}): ${rimsaTwoSidedMatch[1]} m`, rimsaTwoSidedMatch[0]);
      emit('thickness_back_m', tBack, `Tloušťka rubu (${scope}): ${rimsaTwoSidedMatch[2]} m`, rimsaTwoSidedMatch[0]);
    } else {
      // Generic thickness in this segment: "tloušťky 0,15 m", "tloušťka 0,56 m".
      const segThicknessMatch = seg.raw.match(/tlou[šs][ťt]k\w*\s+(\d+[,.]\d+)\s*m\b/i);
      if (segThicknessMatch) {
        const t = parseFloat(segThicknessMatch[1].replace(',', '.'));
        emit('thickness_m', t, `Tloušťka (${scope}): ${segThicknessMatch[1]} m`, segThicknessMatch[0]);
      }
    }
    // Generic width: "šířky 2,75 m", "Šířka 0,85 m".
    const segWidthMatch = seg.raw.match(/[šs][ií][řr]k\w*\s+(\d+[,.]\d+)\s*m\b/i);
    if (segWidthMatch) {
      const w = parseFloat(segWidthMatch[1].replace(',', '.'));
      emit('width_m', w, `Šířka (${scope}): ${segWidthMatch[1]} m`, segWidthMatch[0]);
    }
    // Variable-height range: "proměnné výšky 1,65 – 3,50 m". Anchored on
    // a v[ýy]šk\w+ keyword so it doesn't fire on the Block A "od X do Y m"
    // pattern (which already emits height_above_terrain_*).
    const segHeightRangeMatch = seg.raw.match(/v[ýy][šs]k\w*\s+(\d+[,.]\d+)\s*[–\-]\s*(\d+[,.]\d+)\s*m\b/i);
    if (segHeightRangeMatch) {
      const lo = parseFloat(segHeightRangeMatch[1].replace(',', '.'));
      const hi = parseFloat(segHeightRangeMatch[2].replace(',', '.'));
      emit('height_min_m', lo, `Min. výška (${scope}): ${segHeightRangeMatch[1]} m`, segHeightRangeMatch[0]);
      emit('height_max_m', hi, `Max. výška (${scope}): ${segHeightRangeMatch[2]} m`, segHeightRangeMatch[0]);
    }
  }

  // 3. Span pattern: "15 + 4 × 20 + 15 m" or "15.000 + 4 x 20.000 + 15.000"
  const spanShort = /(\d+[.,]?\d*)\s*\+\s*(\d+)\s*[×x]\s*(\d+[.,]?\d*)\s*\+\s*(\d+[.,]?\d*)/;
  const spanMatch = text.match(spanShort);
  if (spanMatch) {
    const first = parseFloat(spanMatch[1].replace(',', '.'));
    const count = parseInt(spanMatch[2]);
    const middle = parseFloat(spanMatch[3].replace(',', '.'));
    const last = parseFloat(spanMatch[4].replace(',', '.'));
    const numSpans = count + 2;
    results.push({
      name: 'span_m', value: middle, label_cs: `Rozpětí: ${middle} m (max pole)`,
      confidence: 1.0, source: 'regex', matched_text: spanMatch[0],
    });
    results.push({
      name: 'num_spans', value: numSpans, label_cs: `Počet polí: ${numSpans}`,
      confidence: 1.0, source: 'regex', matched_text: spanMatch[0],
    });
  } else {
    // Fallback: "X polí"
    const poliMatch = normalized.match(/(\d+)\s*poli/);
    if (poliMatch) {
      results.push({
        name: 'num_spans', value: parseInt(poliMatch[1]),
        label_cs: `Počet polí: ${poliMatch[1]}`,
        confidence: 1.0, source: 'regex', matched_text: poliMatch[0],
      });
    }
  }

  // 4. Width: "šířka NK 10.250 m" or "10,25 m" — use normalized text
  const widthMatch = normalized.match(/sirk[aay]\s*(?:nk\s*)?(?:(?:lev|prav)\S*\s*(?:i\s*\S+\s*)?mostu\s*(?:je\s*)?)?(?:konstantni\s*)?(\d+[.,]\d+)\s*m\b/);
  if (widthMatch) {
    const w = parseFloat(widthMatch[1].replace(',', '.'));
    results.push({
      name: 'nk_width_m', value: w, label_cs: `Šířka NK: ${w} m`,
      confidence: 1.0, source: 'regex', matched_text: widthMatch[0],
    });
  }

  // 5. Length: "délka NK činí 111.500 m" — use normalized text
  const lengthMatch = normalized.match(/delk[aay]\s*(?:nk\s*)?(?:(?:lev|prav)\S*\s*(?:i\s*\S+\s*)?mostu\s*)?(?:cini\s*)?(\d+[.,]\d+)\s*m\b/);
  if (lengthMatch) {
    const l = parseFloat(lengthMatch[1].replace(',', '.'));
    results.push({
      name: 'total_length_m', value: l, label_cs: `Délka NK: ${l} m`,
      confidence: 0.9, source: 'regex', matched_text: lengthMatch[0],
    });
  }

  // 6. Volume: "605 m³" or "605m3" — skipped if a smeta line already pinned volume_m3
  if (!smetaFieldNames.has('volume_m3')) {
    const volMatch = text.match(/(\d+[.,]?\d*)\s*m[³3]/);
    if (volMatch) {
      results.push({
        name: 'volume_m3', value: parseFloat(volMatch[1].replace(',', '.')),
        label_cs: `Objem: ${volMatch[1]} m³`,
        confidence: 0.9, source: 'regex', matched_text: volMatch[0],
      });
    }
  }

  // 7. Height: "výšk* X m"
  const heightMatch = text.match(/v[yý][šs]k[aáy]\s*(\d+[.,]?\d*)\s*m/i);
  if (heightMatch) {
    results.push({
      name: 'height_m', value: parseFloat(heightMatch[1].replace(',', '.')),
      label_cs: `Výška: ${heightMatch[1]} m`,
      confidence: 0.9, source: 'regex', matched_text: heightMatch[0],
    });
  }

  // 8. Diameter: "Ø900 mm" or "∅1200"
  const diaMatch = text.match(/[∅Ø]\s*(\d+)\s*(?:mm)?/);
  if (diaMatch) {
    results.push({
      name: 'pile_diameter_mm', value: parseInt(diaMatch[1]),
      label_cs: `Průměr piloty: Ø${diaMatch[1]} mm`,
      confidence: 1.0, source: 'regex', matched_text: diaMatch[0],
    });
  }

  // 9. Number of cables: "12 kabelů" or "12 soudržnými kabely"
  const cableMatch = text.match(/(\d+)\s*(?:soudržn\S*\s*)?kabel/i);
  if (cableMatch) {
    results.push({
      name: 'prestress_cables_count', value: parseInt(cableMatch[1]),
      label_cs: `Počet kabelů: ${cableMatch[1]}`,
      confidence: 1.0, source: 'regex', matched_text: cableMatch[0],
    });
  }

  // 10. Strands per cable: "13 lany" or "19 lan"
  const strandMatch = text.match(/(\d+)\s*lan[yůa]/i);
  if (strandMatch) {
    results.push({
      name: 'prestress_strands_per_cable', value: parseInt(strandMatch[1]),
      label_cs: `Lan per kabel: ${strandMatch[1]}`,
      confidence: 1.0, source: 'regex', matched_text: strandMatch[0],
    });
  }

  // 11. Thickness: "tl. 250 mm"
  const thickMatch = text.match(/tl\.?\s*(\d+)\s*mm/i);
  if (thickMatch) {
    results.push({
      name: 'thickness_mm', value: parseInt(thickMatch[1]),
      label_cs: `Tloušťka: ${thickMatch[1]} mm`,
      confidence: 1.0, source: 'regex', matched_text: thickMatch[0],
    });
  }

  // 12. Rebar ratio: "150 kg/m³" / "150 kg/m3" — informational, no FormState
  //     binding yet (user sees it as a hint alongside volume + rebar total).
  const rebarRatioMatch = text.match(/(\d+[.,]?\d*)\s*kg\s*\/\s*m\s*[³3]/i);
  if (rebarRatioMatch) {
    const ratio = parseFloat(rebarRatioMatch[1].replace(',', '.'));
    results.push({
      name: 'reinforcement_ratio_kg_m3',
      value: ratio,
      label_cs: `Norma výztuže: ${ratio} kg/m³`,
      confidence: 1.0, source: 'regex', matched_text: rebarRatioMatch[0],
    });
  }

  // ─── Block B dimension pack (follow-up to Fix #1, 2026-05-14) ──────────
  //
  // Whole-text patterns that don't fit the per-segment scoped sweep
  // because they describe global project structure (dilatation cells) or
  // attach to the implicit face_cladding context regardless of where the
  // anchor word appears in the document.

  // "na 40 dilatačních celků konstantní délky 12,50 m" — main cell count
  // + main cell length captured in one go. Note: `\w` in JS regex is
  // ASCII-only ([A-Za-z0-9_]), which excludes Czech diacritics — "celků"
  // ends in "ů" so `celk\w+` fails. Use `\S+` for the noun-suffix tail.
  const mainDilatMatch = text.match(/na\s+(\d+)\s+dilata\S+\s+celk\S*\s+konstantn\S+\s+d[ée]lk\S+\s+(\d+[,.]\d+)\s*m\b/i);
  if (mainDilatMatch) {
    results.push({
      name: 'dilatation_main_count', value: parseInt(mainDilatMatch[1], 10),
      label_cs: `Hlavní dilatačních celků: ${mainDilatMatch[1]}`,
      confidence: 1.0, source: 'regex', matched_text: mainDilatMatch[0],
    });
    results.push({
      name: 'dilatation_main_length_m', value: parseFloat(mainDilatMatch[2].replace(',', '.')),
      label_cs: `Délka hlavního celku: ${mainDilatMatch[2]} m`,
      confidence: 1.0, source: 'regex', matched_text: mainDilatMatch[0],
    });
  }

  // "dva krajní dilatační celky … konstantní délky 7,60 m" — edge count
  // via Czech word-numeral (dva/tři/čtyři) + edge length.
  const edgeDilatMatch = text.match(
    /\b(dva|tři|čtyři|tri|ctyri)\s+krajn\S+\s+dilata\S+\s+celk\S*[^.]*?d[ée]lk\S+\s+(\d+[,.]\d+)\s*m\b/i,
  );
  if (edgeDilatMatch) {
    const numerals: Record<string, number> = { dva: 2, tři: 3, tri: 3, čtyři: 4, ctyri: 4 };
    const count = numerals[edgeDilatMatch[1].toLowerCase()] ?? NaN;
    if (Number.isFinite(count)) {
      results.push({
        name: 'dilatation_edge_count', value: count,
        label_cs: `Krajních dilatačních celků: ${count}`,
        confidence: 0.9, source: 'regex', matched_text: edgeDilatMatch[0],
      });
    }
    results.push({
      name: 'dilatation_edge_length_m', value: parseFloat(edgeDilatMatch[2].replace(',', '.')),
      label_cs: `Délka krajního celku: ${edgeDilatMatch[2]} m`,
      confidence: 1.0, source: 'regex', matched_text: edgeDilatMatch[0],
    });
  }

  // Face-cladding material keyword: "lomovým kamenem" / "lomový kámen".
  // `\S+` instead of `\w+` because Czech diacritics (ý/ě/á) aren't in
  // ASCII `\w` (no /u flag).
  if (/lomov\S+\s+k[áa]men\S*/i.test(text)) {
    results.push({
      name: 'face_cladding_material', value: 'lomový kámen',
      label_cs: 'Lícový obklad: lomový kámen',
      confidence: 0.9, source: 'keyword', matched_text: 'lomový kámen',
      element_scope: 'face_cladding',
    });
  }

  // Anchor type: "vlepenými kotvami R8" / "kotvy R8". The numeric suffix
  // is the bar diameter in mm — emit canonical "R<n>".
  const anchorTypeMatch = text.match(/kotv\w*[^A-Za-z]*R\s*(\d+)\b/i);
  if (anchorTypeMatch) {
    results.push({
      name: 'face_cladding_anchor_type', value: `R${anchorTypeMatch[1]}`,
      label_cs: `Kotvy: R${anchorTypeMatch[1]}`,
      confidence: 0.95, source: 'regex', matched_text: anchorTypeMatch[0],
      element_scope: 'face_cladding',
    });
  }

  // Anchor grid: "v rastru minimálně 0,75 x 0,75 m" — emit a [W, H] array.
  // `\S+` for "minimálně" (non-ASCII letters).
  const anchorGridMatch = text.match(/v\s+rastru\s+(?:minim\S+\s+)?(\d+[,.]\d+)\s*[x×]\s*(\d+[,.]\d+)\s*m\b/i);
  if (anchorGridMatch) {
    // ExtractedParam.value is string|number|boolean|string[] — emit the
    // two dimensions as numeric strings so the consumer can JSON.parse
    // them and the probe's `.map(String)` equality check matches an
    // expected `[0.75, 0.75]`.
    const w = parseFloat(anchorGridMatch[1].replace(',', '.'));
    const h = parseFloat(anchorGridMatch[2].replace(',', '.'));
    results.push({
      name: 'face_cladding_anchor_grid_m', value: [String(w), String(h)],
      label_cs: `Rastr kotev: ${anchorGridMatch[1]} × ${anchorGridMatch[2]} m`,
      confidence: 1.0, source: 'regex', matched_text: anchorGridMatch[0],
      element_scope: 'face_cladding',
    });
  }

  // Rebar grade: "B 500 B" / "B500B". The trailing letter (A/B/C)
  // designates the bond class per ČSN EN 10080. Emit canonical "B500B".
  const rebarGradeMatch = text.match(/\bB\s*(\d{3})\s*([ABCabc])?\b/);
  if (rebarGradeMatch) {
    const grade = `B${rebarGradeMatch[1]}${(rebarGradeMatch[2] ?? '').toUpperCase()}`;
    results.push({
      name: 'rebar_grade', value: grade, label_cs: `Třída výztuže: ${grade}`,
      confidence: 1.0, source: 'regex', matched_text: rebarGradeMatch[0],
    });
  }

  // ─── Project identification pack (Fix #2, 2026-05-14, SO-250 audit) ────
  //
  // ŘSD TZ headers share a stable structure across projects. The first
  // page of every SO-NNN doc has: Číslo objektu / Název / Druh
  // komunikace / Staničení / Stupeň dokumentace / Délka / Výška /
  // Pohledová plocha. This pack adds the regex coverage for the seven
  // header fields plus a few drawing-side helpers (H=1,15 m, Edef ≥ X
  // MPa, třída těžitelnosti) so Block A / D / E coverage rises from
  // 0 % to a meaningful baseline. All patterns are conservative —
  // they require a recognisable Czech anchor word so they don't fire
  // on prose with stray numbers.

  // SO number: "Číslo objektu SO 250" or just "SO 250" anywhere.
  const soMatch = text.match(/\bSO\s*[-–]?\s*(\d{3})\b/);
  if (soMatch) {
    results.push({
      name: 'object_id', value: `SO ${soMatch[1]}`, label_cs: `Číslo objektu: SO ${soMatch[1]}`,
      confidence: 1.0, source: 'regex', matched_text: soMatch[0],
    });
  }

  // Road: "dálnice D6", "rychlostní silnice R10", "silnice I/23".
  const roadMatch = text.match(/\bd[áa]lnice\s+(D\d+)\b|\brychlostn[ií]\s+silnice\s+(R\d+)\b|\bsilnice\s+(I+\/\d+)\b/i);
  if (roadMatch) {
    const road = roadMatch[1] ?? roadMatch[2] ?? roadMatch[3];
    results.push({
      name: 'road', value: road, label_cs: `Komunikace: ${road}`,
      confidence: 1.0, source: 'regex', matched_text: roadMatch[0],
    });
  }

  // Stationing range: "km 6,492 40 – 7,007 60" — the trailing two-digit
  // group is centimetres (ŘSD convention). Emit canonical "km+m.cm" form.
  const stMatch = text.match(/km\s+(\d+),(\d{3})\s+(\d{2})\s*[–\-]\s*(\d+),(\d{3})\s+(\d{2})/);
  if (stMatch) {
    const fmt = (k: string, m: string, cm: string) => `${k}+${m}.${cm}`;
    results.push({
      name: 'stationing_from', value: fmt(stMatch[1], stMatch[2], stMatch[3]),
      label_cs: `Staničení od: ${stMatch[1]}+${stMatch[2]}.${stMatch[3]}`,
      confidence: 1.0, source: 'regex', matched_text: stMatch[0],
    });
    results.push({
      name: 'stationing_to', value: fmt(stMatch[4], stMatch[5], stMatch[6]),
      label_cs: `Staničení do: ${stMatch[4]}+${stMatch[5]}.${stMatch[6]}`,
      confidence: 1.0, source: 'regex', matched_text: stMatch[0],
    });
  }

  // Documentation stage acronyms.
  const docStageMatch = text.match(/\b(DUR|DSP|PDPS|RDS|DSPS)\b/);
  if (docStageMatch) {
    results.push({
      name: 'documentation_stage', value: docStageMatch[1],
      label_cs: `Stupeň dokumentace: ${docStageMatch[1]}`,
      confidence: 1.0, source: 'regex', matched_text: docStageMatch[0],
    });
  }

  // Total length: "Délka zdi 515,20 m", "Délka mostu 75,3 m". Requires the
  // anchor noun (zdi/mostu/objektu/oblouku) so it doesn't fire on prose
  // like "délka 12,5 m" inside the dilatation sentence.
  const lengthMatch2 = text.match(/D[ée]lka\s+(?:zdi|mostu|objektu|oblouku|\S{0,12}cs)\s+(\d+[.,]\d+)\s*m\b/i);
  if (lengthMatch2) {
    const l = parseFloat(lengthMatch2[1].replace(',', '.'));
    if (!results.some((r) => r.name === 'total_length_m')) {
      results.push({
        name: 'total_length_m', value: l, label_cs: `Délka: ${lengthMatch2[1]} m`,
        confidence: 1.0, source: 'regex', matched_text: lengthMatch2[0],
      });
    }
    // Also emit the audit's `length_m` alias for SO-250's expected matrix.
    results.push({
      name: 'length_m', value: l, label_cs: `Délka objektu: ${lengthMatch2[1]} m`,
      confidence: 1.0, source: 'regex', matched_text: lengthMatch2[0],
    });
  }

  // Visible area: "Pohledová plocha zdi 1737,44 m2".
  const visAreaMatch = text.match(/Pohledov[áa]\s+plocha\s+(?:\w+\s+)?(\d+[.,]\d+)\s*m\s*[²2]/i);
  if (visAreaMatch) {
    results.push({
      name: 'visible_area_m2', value: parseFloat(visAreaMatch[1].replace(',', '.')),
      label_cs: `Pohledová plocha: ${visAreaMatch[1]} m²`,
      confidence: 1.0, source: 'regex', matched_text: visAreaMatch[0],
    });
  }

  // Height range: "od 1,550 do 3,400 m" — emits both min and max.
  const heightRangeMatch = text.match(/od\s+(\d+[.,]\d+)\s+do\s+(\d+[.,]\d+)\s*m\b/i);
  if (heightRangeMatch) {
    const lo = parseFloat(heightRangeMatch[1].replace(',', '.'));
    const hi = parseFloat(heightRangeMatch[2].replace(',', '.'));
    results.push({
      name: 'height_above_terrain_min_m', value: lo,
      label_cs: `Min. výška: ${heightRangeMatch[1]} m`,
      confidence: 0.95, source: 'regex', matched_text: heightRangeMatch[0],
    });
    results.push({
      name: 'height_above_terrain_max_m', value: hi,
      label_cs: `Max. výška: ${heightRangeMatch[2]} m`,
      confidence: 0.95, source: 'regex', matched_text: heightRangeMatch[0],
    });
  }

  // Title line: "Název objektu Zárubní zeď v km 6,500 – 7,000 vpravo".
  const nameMatch = text.match(/N[áa]zev\s+objektu\s+(.+?)(?:\r?\n|$)/i);
  if (nameMatch) {
    results.push({
      name: 'object_name', value: nameMatch[1].trim(),
      label_cs: `Název objektu: ${nameMatch[1].trim()}`,
      confidence: 0.95, source: 'regex', matched_text: nameMatch[0].trim(),
    });
  }

  // Drawing-side helpers (Fix #2 also unlocks the 4th conflict from §4).

  // Railing height on drawing: "H=1,15 m" or "H = 1,15 m".
  const railingDrawingMatch = text.match(/(?:Z[ÁA]BRADL[ÍI]|zábradl[íi])[^.\n]*?H\s*=\s*(\d+[.,]\d+)\s*m\b/);
  if (railingDrawingMatch) {
    const h = parseFloat(railingDrawingMatch[1].replace(',', '.'));
    results.push({
      name: 'railing_height_drawing_m', value: h,
      label_cs: `Výška zábradlí (výkres): ${railingDrawingMatch[1]} m`,
      confidence: drawingMode ? 0.85 : 1.0,
      source: drawingMode ? 'drawing' : 'regex',
      matched_text: railingDrawingMatch[0],
    });
  }

  // TZ-side railing height: "navrženo silniční zábradlí výška 1,10 m".
  const railingTzMatch = text.match(/z[áa]bradl[íi]\s+v[ýy][šs]ka\s+(\d+[.,]\d+)\s*m\b/i);
  if (railingTzMatch) {
    const h = parseFloat(railingTzMatch[1].replace(',', '.'));
    results.push({
      name: 'railing_height_m', value: h,
      label_cs: `Výška zábradlí: ${railingTzMatch[1]} m`,
      confidence: 1.0, source: 'regex', matched_text: railingTzMatch[0],
    });
  }

  // Geotechnika helpers (Block E partial — easiest wins only).

  // "Edef,2 ≥ 60 MPa" — base subgrade deformation modulus.
  const edefMatch = text.match(/Edef\s*,?\s*2\s*[≥>=]+\s*(\d+)\s*MPa/i);
  if (edefMatch) {
    results.push({
      name: 'edef2_base_MPa', value: parseInt(edefMatch[1], 10),
      label_cs: `Edef,2 ≥ ${edefMatch[1]} MPa`,
      confidence: 1.0, source: 'regex', matched_text: edefMatch[0],
    });
  }

  // "Edef,2/Edef,1 ≤ 2,5" — ratio.
  const edefRatioMatch = text.match(/Edef[,\s]*2\s*\/\s*Edef[,\s]*1\s*[≤<=]+\s*(\d+[.,]\d+)/i);
  if (edefRatioMatch) {
    results.push({
      name: 'edef_ratio_max', value: parseFloat(edefRatioMatch[1].replace(',', '.')),
      label_cs: `Edef,2/Edef,1 ≤ ${edefRatioMatch[1]}`,
      confidence: 0.95, source: 'regex', matched_text: edefRatioMatch[0],
    });
  }

  // "bludným proudům: 3" — stray-currents protection grade.
  const strayMatch = text.match(/bludn[ýy]m\s+proud[ůu]m:?\s*(\d+)/i);
  if (strayMatch) {
    results.push({
      name: 'stray_currents_grade', value: parseInt(strayMatch[1], 10),
      label_cs: `Bludné proudy: stupeň ${strayMatch[1]}`,
      confidence: 0.95, source: 'regex', matched_text: strayMatch[0],
    });
  }

  // "třída těžitelnosti I.-III" — Roman-numeral excavation class.
  const excClassMatch = text.match(/t[ěe]ž[ií]telnosti\s+(I+V?\.?\s*[-–]\s*I+V?)/i);
  if (excClassMatch) {
    // Normalise to "I-III" by collapsing whitespace + stripping dots.
    const canonical = excClassMatch[1].replace(/[.\s]/g, '').replace(/–/, '-');
    results.push({
      name: 'excavation_class_main', value: canonical,
      label_cs: `Třída těžitelnosti: ${canonical}`,
      confidence: 0.95, source: 'regex', matched_text: excClassMatch[0],
    });
  }

  // "lokálně IV" — Roman-numeral local-max excavation class.
  const excLocalMatch = text.match(/lok[áa]ln[ěe]\s+(I+V?)/i);
  if (excLocalMatch) {
    results.push({
      name: 'excavation_class_local_max', value: excLocalMatch[1],
      label_cs: `Lokálně až: ${excLocalMatch[1]}`,
      confidence: 0.85, source: 'regex', matched_text: excLocalMatch[0],
    });
  }

  // "Geologie: granit karlovarského plutonu" — free-form keyword.
  const geologyMatch = text.match(/Geologie:\s*([^.\n]+)/i);
  if (geologyMatch) {
    results.push({
      name: 'geology_main', value: geologyMatch[1].trim(),
      label_cs: `Geologie: ${geologyMatch[1].trim()}`,
      confidence: 0.85, source: 'keyword', matched_text: geologyMatch[0].trim(),
    });
  }

  // ─── Keyword-based detection ────────────────────────────────────────────

  // Prestressed — covers: předpjatý, předepne, předpětí, předpínací
  if (/predp[ei]t|predpjat|predepn|predpin/i.test(normalized)) {
    results.push({
      name: 'is_prestressed', value: true, label_cs: 'Předpjatý beton',
      confidence: 1.0, source: 'keyword', matched_text: 'předpjatý',
    });
  }

  // Stressing type
  if (/jednostrann/i.test(normalized)) {
    results.push({
      name: 'prestress_tensioning', value: 'one_sided', label_cs: 'Napínání: jednostranné',
      confidence: 1.0, source: 'keyword', matched_text: 'jednostranné',
    });
  } else if (/oboustrann/i.test(normalized)) {
    results.push({
      name: 'prestress_tensioning', value: 'both_sides', label_cs: 'Napínání: oboustranné',
      confidence: 1.0, source: 'keyword', matched_text: 'oboustranné',
    });
  }

  // Element type keywords.
  //
  // Fix #0 (2026-05-14, SO-250 audit follow-up): the previous if/else
  // ordering tested `rimsa` before `operne_zdi`. Because `norm()` strips
  // diacritics, "ŘÍMSA" inside a retaining-wall transcript (e.g. SO-250
  // Block D — "OPĚRNÁ ZEĎ ŘÍMSA  C30/37 ...") matched first and the
  // dominant element family (the wall itself) never got a chance. The
  // 2-word `opern\w* + zd|zed|sten` pattern is strictly more specific
  // than a 1-word `rimsa` substring, so reorder it ahead and let `rimsa`
  // remain as the fallback for genuine římsa-only transcripts. Plain
  // "ŘÍMSOVÁ DESKA" (existing classifier test fixture) still routes to
  // `rimsa` because the opern pattern needs both words.
  if (/mostovk|nosna\s*konstrukc|nosnou\s*konstrukc/i.test(normalized)) {
    results.push({
      name: 'element_type', value: 'mostovkova_deska', label_cs: 'Typ: mostovková deska',
      confidence: 0.9, source: 'keyword', matched_text: 'mostovka/NK',
    });
  } else if (/pilot[aoy]|vrtana|vrtane/i.test(normalized)) {
    results.push({
      name: 'element_type', value: 'pilota', label_cs: 'Typ: pilota',
      confidence: 0.9, source: 'keyword', matched_text: 'pilota',
    });
  } else if (/opern\w*\s+(zd|zed|sten)/i.test(normalized)) {
    // "opěrná zeď", "opěrné zdi", "opěrných stěn" — bridge abutment wall /
    // civil retaining wall. Diacritics already stripped by `norm()`.
    results.push({
      name: 'element_type', value: 'operne_zdi', label_cs: 'Typ: opěrná zeď',
      confidence: 0.9, source: 'keyword', matched_text: 'opěrná zeď / stěna',
    });
  } else if (/rimsa|rimsy|rimsov/i.test(normalized)) {
    results.push({
      name: 'element_type', value: 'rimsa', label_cs: 'Typ: římsa',
      confidence: 0.9, source: 'keyword', matched_text: 'římsa',
    });
  }

  // Dvoutrám subtype
  if (/dvoutram|dvou\s*tram/i.test(normalized)) {
    results.push({
      name: 'bridge_deck_subtype', value: 'dvoutram', label_cs: 'Podtyp: dvoutrám',
      confidence: 1.0, source: 'keyword', matched_text: 'dvoutrám',
    });
  }

  // Sort by confidence desc
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
