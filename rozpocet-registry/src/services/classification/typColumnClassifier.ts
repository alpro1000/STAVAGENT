/**
 * Typ-column fast-path classifier — ROW_CLASSIFICATION_ALGORITHM v1.1 §2.
 *
 * When column auto-detection found a `typ` column, we can classify rows
 * deterministically via a marker → role lookup. Producer-specific markers
 * are unified into one TYP_MAP — EstiCon and Komplet vocabularies don't
 * overlap ambiguously:
 *
 *   EstiCon: SO / O / O1 / SD → section, P → main, PP / VV / TS → subordinate
 *   Komplet: D → section, K → main, PP / PSC / VV → subordinate
 *
 * PP and VV appear in both vocabularies and both map to subordinate. That's
 * the only intersection and it's non-conflicting.
 *
 * Confidence: 1.0 when marker recognized (deterministic), 0.0 when unknown
 * (row is downgraded to 'unknown' and caller may retry via content-heuristic
 * path in edge case §12).
 */

import type { ClassifiedRowBase, RawRow, ColumnMapping, SourceFormat } from './classifierTypes';

/** Unified marker → role map. Order matters for SourceFormat inference below
 *  (EstiCon-only markers tried first so Komplet's 'K' isn't mistaken for
 *  anything else). */
const TYP_MAP: Record<string, 'section' | 'main' | 'subordinate'> = {
  // EstiCon markers
  'SO': 'section',
  'O': 'section',
  'O1': 'section',
  'SD': 'section',
  'P': 'main',
  'TS': 'subordinate',
  // Komplet markers
  'D': 'section',
  'K': 'main',
  'PSC': 'subordinate',
  // Shared between EstiCon + Komplet
  'PP': 'subordinate',
  'VV': 'subordinate',
};

/** Markers unique to EstiCon — used to infer sourceFormat hint. */
const ESTICON_MARKERS = new Set(['SO', 'O', 'O1', 'SD', 'P', 'TS']);
/** Markers unique to Komplet. */
const KOMPLET_MARKERS = new Set(['D', 'K', 'PSC']);

/**
 * Normalize a Typ column cell to its canonical uppercase marker form.
 * Returns '' when the cell is empty or non-string.
 */
export function normalizeTypMarker(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  const s = String(cell).trim().toUpperCase();
  return s;
}

/**
 * Given a batch of Typ values, infer the producer signature. Used to populate
 * `source_format` on each classified item — advisory only, does NOT branch
 * logic. Returns null when the batch is ambiguous or empty.
 */
export function inferSourceFormat(typValues: string[]): SourceFormat | null {
  let esticonHits = 0;
  let kompletHits = 0;
  for (const t of typValues) {
    if (ESTICON_MARKERS.has(t)) esticonHits++;
    else if (KOMPLET_MARKERS.has(t)) kompletHits++;
  }
  if (esticonHits === 0 && kompletHits === 0) return null;
  if (esticonHits > kompletHits * 2) return 'EstiCon';
  if (kompletHits > esticonHits * 2) return 'Komplet';
  return null; // mixed / ambiguous
}

/** Safe parse of a numeric cell. Handles CZ decimal commas + thousand spaces. */
function parseNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  const s = String(cell).trim();
  if (!s) return null;
  // Reject Excel error tokens (#REF!, #N/A, #VALUE!...)
  if (s.startsWith('#')) return null;
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
}

/** Parse a string cell or return null for blank/non-string values. */
function parseString(cell: unknown): string | null {
  if (cell === null || cell === undefined) return null;
  const s = String(cell).trim();
  return s === '' ? null : s;
}

/** Normalize MJ column — strip whitespace, lowercase per spec §6 edge case #5. */
function parseMj(cell: unknown): string | null {
  const s = parseString(cell);
  return s === null ? null : s.toLowerCase();
}

/** Parse a Poř. číslo cell. Accepts int or numeric string; returns null otherwise. */
function parsePor(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number' && Number.isFinite(cell)) return Math.trunc(cell);
  const s = String(cell).trim();
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Generate a stable id for a classified row. We use a deterministic
 * `typ-<sheet>-<row>` format rather than crypto.randomUUID so re-running
 * the classifier on the same input produces the same ids (makes diffs
 * reproducible during development and tests).
 */
function generateId(sheet: string, rowIdx: number): string {
  return `typ-${sheet.replace(/[^a-zA-Z0-9_-]/g, '_')}-${rowIdx}`;
}

/**
 * Classify a single row via the Typ-column fast path.
 *
 * Returns null when the row should be skipped entirely (empty Typ + empty
 * popis — common in Komplet files that have blank spacer rows between
 * sections). Caller should not push null results into the classified array.
 */
export function classifyTypRow(
  row: RawRow,
  mapping: ColumnMapping,
  sourceFormat: SourceFormat | null,
): ClassifiedRowBase | null {
  if (mapping.typ === null) {
    throw new Error('classifyTypRow called without mapping.typ — use content-heuristic classifier instead');
  }

  const typRaw = normalizeTypMarker(row.cells[mapping.typ]);
  const popis = parseString(row.cells[mapping.popis]) ?? '';

  // Edge case §6.8 — skip rows that are entirely empty (no Typ, no popis).
  if (!typRaw && !popis) return null;

  const role = TYP_MAP[typRaw];
  const recognized = role !== undefined;

  // Unknown marker → treat row as 'unknown' with confidence 0. Edge case §6.12.
  // Caller can either accept this or rerun via content-heuristic path.
  const rowRole = recognized ? role : 'unknown';

  return {
    id: generateId(row.sourceSheetName, row.sourceRowIndex),
    rowRole,
    originalTyp: typRaw || null,
    classificationConfidence: recognized ? 1.0 : 0.0,
    classificationSource: 'typ-column',

    por: mapping.por !== null ? parsePor(row.cells[mapping.por]) : null,
    kod: mapping.kod !== null ? parseString(row.cells[mapping.kod]) : null,
    popis,
    mj: mapping.mj !== null ? parseMj(row.cells[mapping.mj]) : null,
    mnozstvi: mapping.mnozstvi !== null ? parseNumber(row.cells[mapping.mnozstvi]) : null,
    cenaJednotkova: mapping.cenaJednotkova !== null ? parseNumber(row.cells[mapping.cenaJednotkova]) : null,
    cenaCelkem: mapping.cenaCelkem !== null ? parseNumber(row.cells[mapping.cenaCelkem]) : null,
    cenovaSoustava: mapping.cenovaSoustava !== null ? parseString(row.cells[mapping.cenovaSoustava]) : null,
    varianta: mapping.varianta !== null ? parseString(row.cells[mapping.varianta]) : null,

    sourceRowIndex: row.sourceRowIndex,
    sourceSheetName: row.sourceSheetName,
    sourceFormat,
  };
}
