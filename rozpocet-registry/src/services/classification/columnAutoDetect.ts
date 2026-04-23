/**
 * Column auto-detection — ROW_CLASSIFICATION_ALGORITHM v1.1 §1.
 *
 * Universal column resolver that works for any tabular estimate regardless of
 * producer (EstiCon / Komplet OTSKP / Komplet ÚRS / RTSROZP / custom). Returns
 * a ColumnMapping which drives both the Typ-column fast-path classifier and
 * the content-heuristic fallback.
 *
 * Two-pass algorithm:
 *   1. Header-text match — scan first 200 rows for a row where ≥ 3 cells match
 *      known header keywords (Kód / Popis / MJ / Množství / Cena / Typ / ...).
 *      This is the preferred path: confidence 0.5 + 0.1 × hits (capped at 1.0)
 *      and detectionSource='header-match'.
 *   2. Content-heuristic fallback — when no header row found, score each
 *      column by how well its content matches expected patterns
 *      (OTSKP/ÚRS code regex → kod, short unit strings → mj, long texts →
 *      popis, numeric → mnozstvi/cena). Used for ragged exports without
 *      proper headers. Confidence capped at 0.7 and detectionSource=
 *      'content-heuristic'.
 *
 * Template hints (from ImportModal preset) short-circuit header search when
 * the known-good column positions match the preset's expected layout. Hint
 * is treated as advisory — if the hinted positions don't actually contain
 * the expected data types, the algorithm falls back to header search.
 */

import type { ColumnMapping, TemplateHint } from './classifierTypes';

/** Maximum rows scanned while looking for the header row. Header in Komplet
 *  exports sits around row 120-125 (after Krycí list + Rekapitulace). 200
 *  gives comfortable margin without scanning whole multi-sheet workbooks. */
const HEADER_SCAN_DEPTH = 200;

/** Minimum keyword matches required to treat a row as the header row. */
const HEADER_MIN_HITS = 3;

/** Normalize a cell value to lowercase string with CZ accents stripped.
 *  Used for keyword matching in header cells — tolerant of 'KÓD'/'kod'/'Kód'. */
function normalize(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  const s = String(cell).trim().toLowerCase();
  // Strip combining marks — handles č → c, ž → z, ú → u, etc. without a
  // hardcoded replacement map.
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Pattern for OTSKP codes: 5-6 digits, optional .xx suffix (variant). */
const OTSKP_CODE_RE = /^[0-9]{5,6}(\.[a-z]+)?$/;
/** Pattern for ÚRS codes: 9 digits. */
const URS_CODE_RE = /^[0-9]{9}$/;
/** Pattern for custom alphanumeric codes (3+ chars, at least one letter). */
const CUSTOM_CODE_RE = /^[A-Z][A-Z0-9]{2,}$/i;

function looksLikeCode(cell: unknown): boolean {
  if (cell === null || cell === undefined) return false;
  const s = String(cell).trim();
  if (!s) return false;
  return OTSKP_CODE_RE.test(s) || URS_CODE_RE.test(s) || CUSTOM_CODE_RE.test(s);
}

function looksLikeUnit(cell: unknown): boolean {
  if (cell === null || cell === undefined) return false;
  const s = normalize(cell);
  if (!s || s.length > 8) return false;
  // Common CZ units — m, m2, m3, kus, t, kg, hod, ks, bm, 100m
  return /^(m[23]?|kus|ks|t|kg|hod|bm|100m|soubor|sada|l|km|mj|ha)$/i.test(s);
}

function looksLikeNumber(cell: unknown): boolean {
  if (cell === null || cell === undefined || cell === '') return false;
  if (typeof cell === 'number') return Number.isFinite(cell);
  const s = String(cell).trim().replace(/\s/g, '').replace(',', '.');
  return !Number.isNaN(Number(s));
}

/** Builds an empty mapping with popis defaulted (will be overwritten). */
function emptyMapping(dataStartRow: number = 0): ColumnMapping {
  return {
    headerRowIndex: null,
    dataStartRow,
    kod: null,
    popis: -1, // sentinel; detection below must set this or caller treats as failure
    mj: null,
    mnozstvi: null,
    cenaJednotkova: null,
    cenaCelkem: null,
    typ: null,
    por: null,
    cenovaSoustava: null,
    varianta: null,
    detectionConfidence: 0,
    detectionSource: 'content-heuristic',
  };
}

/**
 * Track a cell tentatively flagged as a bare 'Cena' header — resolved after
 * a two-row merge in scanHeaderPair when the subheader row disambiguates
 * Jednotková vs Celkem.
 */
type CenaCandidate = { col: number };

/**
 * Scan a single row for header keywords and return a partial mapping.
 * Returns null if fewer than HEADER_MIN_HITS cells matched.
 *
 * The bareCena output captures columns where only "Cena" appeared (no
 * "jednotková"/"celkem" qualifier) — EstiCon uses this pattern where the
 * next row holds subheaders. scanHeaderPair() resolves these candidates
 * by scanning row+1.
 */
function matchHeaderRow(row: unknown[]): { mapping: Partial<ColumnMapping>; hits: number; bareCena: CenaCandidate[] } | null {
  const hit: Partial<ColumnMapping> = {};
  const bareCena: CenaCandidate[] = [];
  let hits = 0;

  for (let colIdx = 0; colIdx < row.length; colIdx++) {
    const norm = normalize(row[colIdx]);
    if (!norm) continue;

    // kod / kód / kód položky / kód pol.
    if (hit.kod === undefined && norm.startsWith('kod')) {
      hit.kod = colIdx; hits++;
      continue;
    }
    // popis / název / název položky / text / text položky
    if (hit.popis === undefined && (
      norm.startsWith('popis') || norm.startsWith('nazev') || norm.startsWith('text')
    )) {
      hit.popis = colIdx; hits++;
      continue;
    }
    // mj / m.j. / jednotka / měrná jednotka
    if (hit.mj === undefined && (
      norm === 'mj' || norm === 'm.j.' || norm.startsWith('jednotka') || norm === 'j' ||
      norm.startsWith('merna') || norm === 'm j'
    )) {
      hit.mj = colIdx; hits++;
      continue;
    }
    // množství / počet
    if (hit.mnozstvi === undefined && (norm.startsWith('mnozstvi') || norm === 'pocet' || norm === 'počet')) {
      hit.mnozstvi = colIdx; hits++;
      continue;
    }
    // cena jednotková (qualified) — includes 'j.cena' / 'jednotkova cena' / 'cena jedn*'
    if (hit.cenaJednotkova === undefined && (
      (norm.includes('cena') && (norm.includes('jedn') || norm.includes('j.'))) ||
      norm === 'j.cena' || norm.startsWith('jednotkova') || norm === 'j cena'
    )) {
      hit.cenaJednotkova = colIdx; hits++;
      continue;
    }
    // cena celkem (qualified)
    if (hit.cenaCelkem === undefined && (
      norm === 'cena celkem' || norm === 'celkem' || (norm.includes('cena') && norm.includes('celk'))
    )) {
      hit.cenaCelkem = colIdx; hits++;
      continue;
    }
    // bare "cena" — ambiguous; queue for two-row resolution
    if (norm === 'cena' && hit.cenaJednotkova === undefined && hit.cenaCelkem === undefined) {
      bareCena.push({ col: colIdx });
      hits++;
      continue;
    }
    // typ
    if (hit.typ === undefined && norm === 'typ') {
      hit.typ = colIdx; hits++;
      continue;
    }
    // Poř. číslo — 'pč' / 'por' / 'č' / 'poř.' / 'poř. číslo' / 'pořadové'
    if (hit.por === undefined && (
      norm === 'pc' || norm === 'por' || norm === 'c' ||
      norm.startsWith('por.') || norm.startsWith('por cislo') || norm.startsWith('poradove')
    )) {
      hit.por = colIdx; hits++;
      continue;
    }
    // Cenová soustava
    if (hit.cenovaSoustava === undefined && (
      norm.startsWith('cenova') || norm === 'cs' || norm === 'soustava'
    )) {
      hit.cenovaSoustava = colIdx; hits++;
      continue;
    }
    // Varianta (EstiCon)
    if (hit.varianta === undefined && (norm.startsWith('varianta') || norm === 'var')) {
      hit.varianta = colIdx; hits++;
      continue;
    }
  }

  if (hits < HEADER_MIN_HITS) return null;
  return { mapping: hit, hits, bareCena };
}

/**
 * Resolve EstiCon-style 2-row headers where primary row has "Cena" and
 * subheader row has "Jednotková" / "Celkem" directly under it. Also
 * scans for stray keywords in the subheader row to fill gaps.
 *
 * Returns the augmented mapping + the additional row offset consumed
 * by the subheader (0 if no subheader was found).
 */
function resolveHeaderPair(
  primaryResult: { mapping: Partial<ColumnMapping>; hits: number; bareCena: CenaCandidate[] },
  subRow: unknown[] | undefined,
): { mapping: Partial<ColumnMapping>; hits: number; subheaderConsumed: boolean } {
  const { mapping, bareCena } = primaryResult;
  let hits = primaryResult.hits;
  if (!subRow || subRow.length === 0) {
    return { mapping, hits, subheaderConsumed: false };
  }

  let resolvedAny = false;

  // Resolve bare Cena columns against the subheader.
  for (const cena of bareCena) {
    const below = normalize(subRow[cena.col]);
    if (below.startsWith('jedn')) {
      if (mapping.cenaJednotkova === undefined) { mapping.cenaJednotkova = cena.col; resolvedAny = true; }
    } else if (below.startsWith('celk')) {
      if (mapping.cenaCelkem === undefined) { mapping.cenaCelkem = cena.col; resolvedAny = true; }
    }
  }

  // Also look in subheader's adjacent columns for the OTHER cena value.
  // EstiCon sometimes splits "Cena" across two columns: row 5 has 'Cena' at
  // col 7, row 6 has 'Jednotková' at col 7 AND 'Celkem' at col 8.
  for (let c = 0; c < subRow.length; c++) {
    const below = normalize(subRow[c]);
    if (!below) continue;
    if (below.startsWith('jedn') && mapping.cenaJednotkova === undefined) {
      mapping.cenaJednotkova = c; resolvedAny = true;
    } else if (below.startsWith('celk') && mapping.cenaCelkem === undefined) {
      mapping.cenaCelkem = c; resolvedAny = true;
    }
  }

  if (resolvedAny) hits += 1; // bump confidence slightly for successful two-row merge
  return { mapping, hits, subheaderConsumed: resolvedAny };
}

/**
 * Detect whether a row is a "column-number" placeholder row that some
 * producers (EstiCon) emit between the header and data — cells contain
 * short integer strings '0','1','2',... mirroring column indices. These
 * rows should be skipped when computing dataStartRow.
 */
function isColumnNumberRow(row: unknown[] | undefined): boolean {
  if (!row || row.length === 0) return false;
  let numeric = 0;
  let nonEmpty = 0;
  for (let i = 0; i < row.length; i++) {
    const v = row[i];
    if (v === '' || v === null || v === undefined) continue;
    nonEmpty++;
    const s = String(v).trim();
    // Match only short ordinal tokens (0..99). Anything else (like a real
    // data value) disqualifies the row.
    if (/^[0-9]{1,2}$/.test(s) && Number(s) === i) numeric++;
  }
  return nonEmpty >= 3 && numeric >= 3 && numeric === nonEmpty;
}

/**
 * Apply content heuristics to decide which column plays which role when no
 * header row was found. Scores each column across a sample of data rows
 * (rows after index 0) and picks the best fit for each role.
 */
function contentHeuristicMapping(rows: unknown[][]): ColumnMapping {
  if (rows.length === 0) return emptyMapping();

  const maxCols = Math.max(...rows.slice(0, 50).map(r => r?.length ?? 0), 0);
  if (maxCols === 0) return emptyMapping();

  // Sample: up to 100 non-empty data rows.
  const sample = rows.filter(r => Array.isArray(r) && r.some(c => c !== null && c !== undefined && c !== '')).slice(0, 100);
  if (sample.length === 0) return emptyMapping();

  type ColStats = {
    codeHits: number;
    unitHits: number;
    numberHits: number;
    totalNonEmpty: number;
    avgTextLen: number;
  };
  const stats: ColStats[] = Array.from({ length: maxCols }, () => ({
    codeHits: 0, unitHits: 0, numberHits: 0, totalNonEmpty: 0, avgTextLen: 0,
  }));
  const textLenSum: number[] = new Array(maxCols).fill(0);

  for (const row of sample) {
    for (let c = 0; c < maxCols; c++) {
      const cell = row[c];
      if (cell === null || cell === undefined || cell === '') continue;
      stats[c].totalNonEmpty++;
      if (looksLikeCode(cell)) stats[c].codeHits++;
      if (looksLikeUnit(cell)) stats[c].unitHits++;
      if (looksLikeNumber(cell)) stats[c].numberHits++;
      if (typeof cell === 'string') textLenSum[c] += cell.length;
    }
  }
  stats.forEach((s, i) => {
    s.avgTextLen = s.totalNonEmpty > 0 ? textLenSum[i] / s.totalNonEmpty : 0;
  });

  // Pick best column per role. Ties broken by leftmost column.
  const pickBestBy = (score: (s: ColStats) => number): number | null => {
    let best: number | null = null;
    let bestScore = -Infinity;
    stats.forEach((s, i) => {
      if (s.totalNonEmpty < Math.max(3, sample.length * 0.1)) return;
      const v = score(s);
      if (v > bestScore) { bestScore = v; best = i; }
    });
    return best;
  };

  const kodCol = pickBestBy(s => s.codeHits / Math.max(1, s.totalNonEmpty));
  const mjCol = pickBestBy(s => s.unitHits / Math.max(1, s.totalNonEmpty));
  // Popis = longest average text column that isn't already the kod column.
  let popisCol: number | null = null;
  let bestLen = 0;
  stats.forEach((s, i) => {
    if (i === kodCol) return;
    if (s.avgTextLen > bestLen && s.totalNonEmpty >= Math.max(3, sample.length * 0.1)) {
      bestLen = s.avgTextLen; popisCol = i;
    }
  });

  // Quantities + prices: columns dominated by numbers, not yet claimed.
  const usedCols = new Set<number>([kodCol, mjCol, popisCol].filter((x): x is number => x !== null));
  const numericCandidates = stats
    .map((s, i) => ({ i, score: s.numberHits / Math.max(1, s.totalNonEmpty), nonEmpty: s.totalNonEmpty }))
    .filter(x => !usedCols.has(x.i) && x.score > 0.6 && x.nonEmpty >= 3)
    .sort((a, b) => b.score - a.score);
  const mnozstviCol = numericCandidates[0]?.i ?? null;
  const cenaJCol = numericCandidates[1]?.i ?? null;
  const cenaCCol = numericCandidates[2]?.i ?? null;

  const mapping: ColumnMapping = {
    headerRowIndex: null,
    dataStartRow: 0,
    kod: kodCol,
    popis: popisCol ?? 0, // last-resort fallback to col 0 if no text column found
    mj: mjCol,
    mnozstvi: mnozstviCol,
    cenaJednotkova: cenaJCol,
    cenaCelkem: cenaCCol,
    typ: null,
    por: null,
    cenovaSoustava: null,
    varianta: null,
    detectionConfidence: popisCol !== null ? 0.5 : 0.2,
    detectionSource: 'content-heuristic',
  };
  return mapping;
}

/**
 * Pre-configured column positions per template hint. Used when ImportModal
 * passes a hint from the user's template pick. These match the producer
 * layouts seen in fixture files as of 2026-04-23.
 */
function hintedMapping(hint: TemplateHint): Partial<ColumnMapping> | null {
  switch (hint) {
    case 'esticon':
      return { typ: 0, por: 1, kod: 2, varianta: 3, popis: 4, mj: 5, mnozstvi: 6, cenaJednotkova: 7, cenaCelkem: 8, cenovaSoustava: 9 };
    case 'komplet':
      return { por: 2, typ: 3, kod: 4, popis: 5, mj: 6, mnozstvi: 7, cenaJednotkova: 8, cenaCelkem: 9, cenovaSoustava: 10 };
    case 'urs-standard':
    case 'otskp':
    case 'rts':
      return { kod: 0, popis: 1, mj: 2, mnozstvi: 3, cenaJednotkova: 4, cenaCelkem: 5 };
    case 'flexible':
    case 'svodny':
    case null:
    case undefined:
      return null;
    default:
      return null;
  }
}

/**
 * Entry point — resolve a ColumnMapping for a sheet's rows.
 *
 * Strategy:
 *   1. If templateHint given, try hinted mapping. Validate popis column
 *      actually contains text in the first 20 data rows; otherwise fall
 *      through.
 *   2. Header-row scan (first HEADER_SCAN_DEPTH rows).
 *   3. Content-heuristic fallback.
 *
 * Guarantees: return value always has `popis` set to a valid column index.
 * If no text column can be identified at all, returns mapping with popis=0
 * and detectionConfidence=0.2 — caller should warn the user.
 */
export function detectColumns(rows: unknown[][], templateHint: TemplateHint = null): ColumnMapping {
  // Empty / trivial sheets — return a safe mapping so downstream code doesn't
  // crash; caller can skip the sheet via unknownCount.
  if (!Array.isArray(rows) || rows.length === 0) {
    return emptyMapping();
  }

  // Step 1: template hint
  const hinted = hintedMapping(templateHint);
  if (hinted && hinted.popis !== undefined) {
    // Validate: does the hinted popis column actually contain text in rows 0-20?
    const sample = rows.slice(0, 20);
    const popisCol = hinted.popis;
    const textDensity = sample.filter(r => {
      const v = r?.[popisCol];
      return typeof v === 'string' && v.trim().length > 3;
    }).length / Math.max(1, sample.length);
    if (textDensity >= 0.2) {
      return {
        ...emptyMapping(),
        ...hinted,
        popis: popisCol,
        headerRowIndex: null,
        dataStartRow: 0, // hint doesn't know where data starts — caller may override
        detectionConfidence: 0.85,
        detectionSource: 'template-hint',
      };
    }
    // Hint didn't match — fall through.
  }

  // Step 2: header-row scan. Two-row headers supported — some producers
  // (EstiCon) put "Cena" on row N and "Jednotková"/"Celkem" subheaders on
  // row N+1, and follow that with a column-number placeholder row
  // ('0'|'1'|'2'...). dataStartRow must clear all header/sub-header noise.
  const scanDepth = Math.min(HEADER_SCAN_DEPTH, rows.length);
  for (let rowIdx = 0; rowIdx < scanDepth; rowIdx++) {
    const row = rows[rowIdx];
    if (!Array.isArray(row)) continue;
    const primary = matchHeaderRow(row);
    if (!primary || primary.mapping.popis === undefined) continue;

    const subRow = rows[rowIdx + 1];
    const resolved = resolveHeaderPair(primary, subRow);
    let dataStartRow = rowIdx + 1 + (resolved.subheaderConsumed ? 1 : 0);

    // Skip an optional column-number placeholder row.
    if (isColumnNumberRow(rows[dataStartRow])) dataStartRow++;

    return {
      ...emptyMapping(),
      ...resolved.mapping,
      popis: resolved.mapping.popis!,
      headerRowIndex: rowIdx,
      dataStartRow,
      detectionConfidence: Math.min(1.0, 0.5 + 0.1 * resolved.hits),
      detectionSource: 'header-match',
    };
  }

  // Step 3: content-heuristic fallback
  return contentHeuristicMapping(rows);
}
