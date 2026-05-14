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
  element_scope?: 'podkladni_beton' | 'zaklad' | 'drik' | 'rimsa' | 'zabradli' | 'kotevni_tram';
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
  // The split granularity is per-line for drawing-dominant inputs (Block
  // D legendas, each line = one element) and per-sentence for prose (TZ
  // paragraph mentions multiple elements separated by periods). We use
  // both passes — the per-line pass catches the drawing case, the
  // per-sentence pass catches the prose case; same scope is emitted only
  // once per unique value.
  const seenScopeValue = new Set<string>(); // "name|scope|value"
  const segments: Array<{ raw: string; norm: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) segments.push({ raw: line, norm: norm(line) });
  }
  // Per-sentence pass: split each line on ". " into sub-segments.
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    for (const sentence of line.split(/(?<=[.;])\s+/)) {
      if (sentence.trim().length > 0 && !segments.some(s => s.raw === sentence)) {
        segments.push({ raw: sentence, norm: norm(sentence) });
      }
    }
  }
  for (const seg of segments) {
    const scope = detectElementScope(seg.norm);
    if (!scope) continue;
    const isSegDrawing = isDrawingLine(seg.raw);
    const segRegexSource: ExtractedParam['source'] = isSegDrawing ? 'drawing' : 'regex';
    const segRegexConf = isSegDrawing ? 0.85 : 1.0;
    // Concrete class in this segment.
    const segConcreteMatches = [...seg.raw.matchAll(/C(\d{2})\/(\d{2,3})/g)].map(mm => mm[0]);
    if (segConcreteMatches.length > 0) {
      // For drawing legendas, the single class on the line is the canonical
      // one for that element. For prose, multiple classes can appear in
      // one sentence — emit the first (line-order) since prose typically
      // names the element first then its class.
      const cls = segConcreteMatches[0];
      const key = `concrete_class|${scope}|${cls}`;
      if (!seenScopeValue.has(key)) {
        seenScopeValue.add(key);
        results.push({
          name: 'concrete_class', value: cls,
          label_cs: `Třída betonu (${scope}): ${cls}`,
          confidence: segRegexConf, source: segRegexSource,
          matched_text: seg.raw.trim(),
          element_scope: scope,
        });
      }
    }
    // Exposure classes in this segment.
    const segExposures = [...seg.raw.matchAll(/\bX(?:0|C[1-4]|D[1-3]|F[1-4]|A[1-3]|M[1-3]|S[1-3])\b/g)].map(mm => mm[0]);
    if (segExposures.length > 0) {
      const uniq = [...new Set(segExposures)];
      const key = `exposure_classes|${scope}|${uniq.join(',')}`;
      if (!seenScopeValue.has(key)) {
        seenScopeValue.add(key);
        results.push({
          name: 'exposure_classes', value: uniq,
          label_cs: `Třídy prostředí (${scope}): ${uniq.join(', ')}`,
          confidence: segRegexConf, source: segRegexSource,
          matched_text: seg.raw.trim(),
          element_scope: scope,
        });
      }
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
