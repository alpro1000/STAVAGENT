/**
 * Content-heuristic classifier — ROW_CLASSIFICATION_ALGORITHM v1.1 §3.
 *
 * Fallback classifier used when column auto-detection did not find a `typ`
 * column. Classifies rows by content pattern analysis:
 *
 *   Rule 1 (section): short kod (1-2 digits) OR popis-only row with CZ
 *     section keyword (e.g. "Zemní práce", "Všeobecné konstrukce").
 *   Rule 2 (main):    non-empty kod + mj + mnozstvi, AND kod matches a
 *     recognized code format (OTSKP 5-6 digits / ÚRS 9 digits / alphanumeric).
 *   Rule 3 (subordinate): any remaining row with non-empty popis.
 *   Rule 4 (unknown): empty / garbage rows.
 *
 * Confidence buckets:
 *   0.9  — section by short kod (highly specific signal)
 *   0.85 — section by keyword match
 *   0.9  — main with recognized code format
 *   0.7  — subordinate by fallthrough
 *   1.0  — unknown (row is definitively empty / skippable)
 */

import type { ClassifiedRowBase, RawRow, ColumnMapping } from './classifierTypes';

/** OTSKP code: 5-6 digits, optional variant suffix like '.kn'. */
const OTSKP_CODE_RE = /^[0-9]{5,6}(\.[a-z]+)?$/;
/** ÚRS code: exactly 9 digits. */
const URS_CODE_RE = /^[0-9]{9}$/;
/** Custom codes: starts with letter, ≥ 3 chars total (e.g. 'A1003', 'SO-101'). */
const CUSTOM_CODE_RE = /^[A-Z][A-Z0-9-]{2,}$/i;
/** Short section kod — 1 or 2 digits only (e.g. '0', '1', '99'). */
const SHORT_SECTION_KOD_RE = /^[0-9]{1,2}$/;

/**
 * CZ construction section vocabulary. Used to detect section rows where
 * the kod column is empty but popis starts with a well-known section name
 * like "Zemní práce" or "Svislé konstrukce". Normalized lowercased +
 * accent-stripped for matching.
 */
const SECTION_KEYWORDS = [
  'zemni prace', 'zakladani', 'svisle konstrukce', 'vodorovne konstrukce',
  'upravy povrchu', 'upravy povrchy', 'podlahy', 'komunikace', 'ostatni konstrukce',
  'bourani', 'presun hmot', 'izolace', 'vseobecne konstrukce', 'vseobecne konstr',
  'instalace', 'konstrukce tesarske', 'konstrukce zamecnicke',
  'hsv', 'psv', 'montaze', 'dokoncovaci prace',
];

/** Strip CZ accents + lowercase for keyword matching. */
function normalize(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  const s = String(cell).trim().toLowerCase();
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isBlankString(s: string | null | undefined): s is null | undefined | '' {
  return s === null || s === undefined || s.trim() === '';
}

function isSectionKeyword(popis: string): boolean {
  const norm = normalize(popis);
  return SECTION_KEYWORDS.some(kw => norm.startsWith(kw));
}

function isValidCode(kod: string): boolean {
  const k = kod.trim();
  if (!k) return false;
  if (OTSKP_CODE_RE.test(k)) return true;
  if (URS_CODE_RE.test(k)) return true;
  if (CUSTOM_CODE_RE.test(k) && !SHORT_SECTION_KOD_RE.test(k)) return true;
  return false;
}

/** Shared number parser — tolerant of CZ decimal commas and Excel errors. */
function parseNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  const s = String(cell).trim();
  if (!s || s.startsWith('#')) return null;
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
}

function parseString(cell: unknown): string | null {
  if (cell === null || cell === undefined) return null;
  const s = String(cell).trim();
  return s === '' ? null : s;
}

function parseMj(cell: unknown): string | null {
  const s = parseString(cell);
  return s === null ? null : s.toLowerCase();
}

function parsePor(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number' && Number.isFinite(cell)) return Math.trunc(cell);
  const n = parseInt(String(cell).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function generateId(sheet: string, rowIdx: number): string {
  return `heur-${sheet.replace(/[^a-zA-Z0-9_-]/g, '_')}-${rowIdx}`;
}

/**
 * Classify a row via content heuristics. Returns null to signal a row the
 * caller should skip entirely (edge §6.8 — fully blank row with no kod and
 * no popis).
 */
export function classifyContentRow(row: RawRow, mapping: ColumnMapping): ClassifiedRowBase | null {
  const kodStr = mapping.kod !== null ? parseString(row.cells[mapping.kod]) : null;
  const popis = mapping.popis !== null ? parseString(row.cells[mapping.popis]) : null;
  const mj = mapping.mj !== null ? parseMj(row.cells[mapping.mj]) : null;
  const mnozstvi = mapping.mnozstvi !== null ? parseNumber(row.cells[mapping.mnozstvi]) : null;
  const cenaJ = mapping.cenaJednotkova !== null ? parseNumber(row.cells[mapping.cenaJednotkova]) : null;
  const cenaC = mapping.cenaCelkem !== null ? parseNumber(row.cells[mapping.cenaCelkem]) : null;
  const cenovaSoustava = mapping.cenovaSoustava !== null ? parseString(row.cells[mapping.cenovaSoustava]) : null;
  const varianta = mapping.varianta !== null ? parseString(row.cells[mapping.varianta]) : null;
  const por = mapping.por !== null ? parsePor(row.cells[mapping.por]) : null;

  // Edge §6.8 — entirely blank row: no kod, no popis. Signal caller to skip.
  if (isBlankString(kodStr) && isBlankString(popis) && mnozstvi === null) {
    return null;
  }

  // Determine rowRole by cascading rules.
  let rowRole: ClassifiedRowBase['rowRole'];
  let confidence: number;

  // Rule 1a — section by short kod (1-2 digits).
  if (kodStr !== null && SHORT_SECTION_KOD_RE.test(kodStr.trim())) {
    rowRole = 'section';
    confidence = 0.9;
  }
  // Rule 1b — section by CZ keyword, with no unit and no quantity.
  else if (
    popis !== null &&
    isBlankString(mj) &&
    (mnozstvi === null || mnozstvi === 0) &&
    isSectionKeyword(popis)
  ) {
    rowRole = 'section';
    confidence = 0.85;
  }
  // Rule 2 — main: kod + mj + mnozstvi all present, kod is recognized format.
  else if (
    kodStr !== null &&
    !isBlankString(mj) &&
    mnozstvi !== null &&
    mnozstvi !== 0 &&
    isValidCode(kodStr)
  ) {
    rowRole = 'main';
    confidence = 0.9;
  }
  // Rule 3 — subordinate: any row with popis that didn't match main/section.
  else if (popis !== null) {
    rowRole = 'subordinate';
    confidence = 0.7;
  }
  // Rule 4 — unknown: nothing substantive.
  else {
    rowRole = 'unknown';
    confidence = 1.0;
  }

  return {
    id: generateId(row.sourceSheetName, row.sourceRowIndex),
    rowRole,
    originalTyp: null, // content path has no Typ column
    classificationConfidence: confidence,
    classificationSource: 'content-heuristic',

    por,
    kod: kodStr,
    popis: popis ?? '',
    mj,
    mnozstvi,
    cenaJednotkova: cenaJ,
    cenaCelkem: cenaC,
    cenovaSoustava,
    varianta,

    sourceRowIndex: row.sourceRowIndex,
    sourceSheetName: row.sourceSheetName,
    sourceFormat: null, // content path can't infer producer reliably
  };
}
