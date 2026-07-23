/**
 * Intent Extractor — Etapa 1 (SPEC §3: структура намерения).
 *
 * A work description stops being a string and becomes a structure. Fully
 * DETERMINISTIC (rules + regex, no model). Design rules ratified 2026-07-22:
 *
 *  - Every extracted field carries {value, source, confidence}. An absent
 *    field stays null / empty array — NEVER a default value.
 *  - Numeric differentiators («tř. 3», «DN 100», «tl. 100 mm», C25/30) are
 *    PRESERVED — they are the most discriminative tokens for catalog matching.
 *  - `unit` comes ONLY from the výměra row (caller-supplied opts.unit), never
 *    guessed from the description text. No opts.unit → null.
 *  - `supply_scope` only from EXPLICIT markers («dodávka a montáž», «D+M»,
 *    «bez dodávky»). Bare «montáž» is an action, not a supply statement.
 *
 * Consumers: matchUrsItemsLocal (search_phrases + search_words feed the SQL
 * candidate pre-filter) today; Etapa 2 gates (unit/supply_scope/specs) next.
 * Sources: 'rule' (vocabulary/position rule), 'regex' (pattern capture),
 * 'vymera' (the výměra row parameter).
 *
 * @module services/intentExtractor
 */

import { normalizeText, foldDiacritics } from '../utils/textNormalizer.js';

// Czech estimate descriptions lead with the action noun. Folded stems;
// a token matches when it equals the stem or starts with it (genitives:
// «montáže», «zřízení» → zrizeni). Curated, not exhaustive — an unlisted
// action simply yields action=null (honest absence, criterion 4).
const ACTION_STEMS = [
  'montaz', 'demontaz', 'zrizeni', 'odstraneni', 'bourani', 'vybourani',
  'betonaz', 'zdeni', 'osazeni', 'osazovani', 'provedeni', 'oprava',
  'vymena', 'doplneni', 'vyrovnani', 'ocisteni', 'cisteni', 'nater',
  'penetrace', 'polozeni', 'kladeni', 'hloubeni', 'zasyp', 'obsyp',
  'prodlouzeni', 'presun', 'rezani', 'vrtani', 'izolace', 'zatepleni',
  'oplechovani', 'poplatek', 'priplatek',
];

// Material / quality specs on the RAW text (verbatim value preserved).
const MATERIAL_SPEC_RES = [
  /\bL?C\s?\d{2}\/\d{2}\b/g,                 // concrete grade C25/30, LC12/13
  /\bB\s?500\s?[AB]?\b/g,                    // rebar steel B500B
  /\btř(?:ídy|ída|\.)?\s*\d+\b/gi,           // skládka/beton třída «tř. 3»
  /\bX[CDFSA]\d\b/g,                         // exposure classes XC1..XF4, XA2
];

// Dimensions / banded sizes on the RAW text.
const DIMENSION_RES = [
  /\bDN\s*\d+(?:\/\d+)?\b/gi,                                    // DN 100, DN 100/150
  /\btl\.?\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)\b/gi,                 // tl. 100 mm
  /\bØ\s*\d+(?:[.,]\d+)?(?:\s*mm)?/g,                            // Ø 900
  /\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?(?:\s*(?:mm|cm|m))?\b/gi, // 300x600 mm
  /\b(?:do|přes|pres|nad)\s+\d+(?:[.,]\d+)?\s*(?:mm|cm|m2|m3|m|kg|t)\b/gi, // ÚRS bands «do 600 mm»
];

// Explicit supply-scope markers (folded). Bare «montaz» is NOT here on purpose.
const SUPPLY_SCOPE_RULES = [
  { re: /\bdodavka a montaz/, value: 'dodavka_a_montaz' },
  { re: /\bdodavka vc(?:etne)? montaze/, value: 'dodavka_a_montaz' },
  { re: /\bvcetne dodavky\b/, value: 'dodavka_a_montaz' },
  { re: /\bd\s*\+\s*m\b/, value: 'dodavka_a_montaz' },
  { re: /\bbez dodavky\b/, value: 'montaz_bez_dodavky' },
  { re: /\bpouze montaz\b/, value: 'montaz_bez_dodavky' },
];

function field(value, source, confidence) {
  return { value, source, confidence };
}

function matchAll(text, regexes) {
  const out = [];
  for (const re of regexes) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push(m[0].trim());
    }
  }
  return [...new Set(out)];
}

/**
 * @param {string} text raw work description
 * @param {{unit?: string}} [opts] výměra-row facts (the ONLY admissible unit source)
 */
export function extractIntent(text, opts = {}) {
  const raw = typeof text === 'string' ? text : '';
  const normalized = normalizeText(raw);

  // --- material specs + dimensions (regex, verbatim value, conf 1.0) ---
  const material_specs = matchAll(raw, MATERIAL_SPEC_RES)
    .map((v) => ({ ...field(v, 'regex', 1.0), normalized: normalizeText(v) }));
  const dimensions = matchAll(raw, DIMENSION_RES)
    .map((v) => ({ ...field(v, 'regex', 1.0), normalized: normalizeText(v) }));

  // --- action (leading action noun; genitive-tolerant stem match) ---
  const tokens = normalized.split(/\s+/).filter(Boolean);
  let action = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const stem = ACTION_STEMS.find((s) => t === s || (s.length >= 5 && t.startsWith(s)));
    if (stem) {
      action = field(stem, 'rule', i === 0 ? 0.9 : 0.7);
      break;
    }
  }

  // --- object (first up-to-3 meaningful tokens that are not the action and
  //     not part of an extracted spec/dimension phrase; heuristic → conf 0.6) ---
  const specTokenSet = new Set(
    [...material_specs, ...dimensions].flatMap((s) => s.normalized.split(/\s+/))
  );
  const objectWords = [];
  for (const t of tokens) {
    if (t.length <= 2) {continue;}
    if (action && (t === action.value || t.startsWith(action.value))) {continue;}
    if (specTokenSet.has(t)) {continue;}
    objectWords.push(t);
    if (objectWords.length === 3) {break;}
  }
  const object = objectWords.length > 0 ? field(objectWords.join(' '), 'rule', 0.6) : null;

  // --- unit: výměra row ONLY (criterion 4: never guessed from text) ---
  const unit = opts.unit ? field(String(opts.unit), 'vymera', 1.0) : null;

  // --- context: parenthetical remark, if any ---
  const paren = raw.match(/\(([^)]{3,})\)/);
  const context = paren ? field(paren[1].trim(), 'rule', 0.5) : null;

  // --- supply_scope: explicit markers only ---
  const foldedLower = foldDiacritics(raw).toLowerCase();
  const scopeRule = SUPPLY_SCOPE_RULES.find((r) => r.re.test(foldedLower));
  const supply_scope = scopeRule ? field(scopeRule.value, 'rule', 1.0) : null;

  // --- search feed for the local SQL door -------------------------------
  // Phrases first (most discriminative: «dn 100» LIKE-matches search_name as a
  // unit), then plain words. Both sides of the comparison pass through the SAME
  // normalizeText, so folding symmetry holds by construction.
  const search_phrases = [...new Set(
    [...dimensions, ...material_specs].map((s) => s.normalized).filter((p) => p.length > 1)
  )];
  const search_words = tokens.filter((w) => w.length > 2);

  return {
    action,
    object,
    material_specs,
    dimensions,
    unit,
    context,
    supply_scope,
    normalized_text: normalized,
    search_phrases,
    search_words,
  };
}
