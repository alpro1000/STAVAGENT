/**
 * Import-adapter helpers — bridge between the ImportModal / legacy parser
 * pipeline and the v1.1 classifier (rowClassifierV2).
 *
 * Four responsibilities:
 *   1. extractRawRows(workbook, sheetName)   — pull XLSX sheet into a 2D
 *      array of raw cell values, ready for classifySheet().
 *   2. getTemplateHint(templateType)          — map ImportModal template
 *      enum to the classifier's TemplateHint.
 *   3. mergeV2IntoParsedItems(parsedItems, v2) — additive upgrade of each
 *      ParsedItem with the classifier's row-role/parent/section/rawCells
 *      fields, matched by source.rowStart ↔ sourceRowIndex+1.
 *   4. appendMissingSubordinates(parsedItems, v2, sheetContext) — insert
 *      synthetic ParsedItem entries for v2 subordinate / section / unknown
 *      rows that have NO matching parsed row. Closes the parser-gap bug
 *      where PP/VV/TS rows (no code in standard mode) were absorbed into
 *      the previous main's popisDetail and therefore never existed as
 *      separate items in the store — even though the classifier output
 *      them correctly. See docs/ROW_CLASSIFICATION_ALGORITHM.md §9.
 *
 * Design note — "additive upgrade" keeps legacy classifyRows() output
 * intact as a fallback when v2 classifier doesn't produce a matching row
 * (e.g. parser's flexibleMode kept a row that v2's detectColumns skipped
 * as header). This is intentional for the migration PR: once integration
 * tests on all three fixtures pass cleanly, a follow-up PR can remove
 * the legacy classifier entirely.
 */

import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import type { ParsedItem } from '../../types';
import { parseNumber } from '../../utils/cellReference';
import type { ClassificationResult, TemplateHint } from './classifierTypes';

/**
 * Convert an XLSX worksheet into a 2D array of raw cell values, preserving
 * blank cells as '' so column indices are stable across rows. Row 0 of the
 * output corresponds to Excel row 1 (0-based here, 1-based in the source
 * file — same convention as `parseExcelSheet`'s internal loop).
 *
 * Uses sheet['!ref'] as the range. Returns [] for empty sheets.
 */
export function extractRawRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const refCell = sheet['!ref'];
  if (!refCell) return [];
  const range = XLSX.utils.decode_range(refCell);
  const rows: unknown[][] = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      // cell.v is the raw value. For formula cells we prefer .v (cached
      // result) over .f. For error cells (#REF!, #N/A) cell.v will be an
      // error object — downstream parseNumber handles the '#'-prefix case.
      row.push(cell?.v ?? '');
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Map the ImportModal template-type enum to the classifier's TemplateHint.
 * Unknown / free-form template types fall through to null so auto-detection
 * runs without hints.
 */
export function getTemplateHint(templateType: string | undefined): TemplateHint {
  switch (templateType) {
    case 'urs-standard':
    case 'otskp':
    case 'rts':
    case 'flexible':
    case 'svodny':
    case 'esticon':
    case 'komplet':
      return templateType as TemplateHint;
    default:
      return null;
  }
}

/**
 * Merge v1.1 classifier output into existing ParsedItem[] in place.
 *
 * Matching rule: `parsedItem.source.rowStart === v2Item.sourceRowIndex + 1`
 * (parser stores 1-based row; v2 stores 0-based).
 *
 * Only writes fields that v2 provides — legacy fields (skupina, popisFull,
 * popisDetail, source, monolith_payload, position_instance_id) are preserved
 * untouched. If a ParsedItem has no matching v2 item, it keeps whatever
 * rowRole / parentItemId the legacy classifyRows() set (silent fallback).
 *
 * @returns object with counts for diagnostic display
 */
export function mergeV2IntoParsedItems(
  parsedItems: ParsedItem[],
  v2Result: ClassificationResult,
): { upgraded: number; unmatched: number } {
  // Index v2 items by their 1-based row equivalent for O(1) lookup.
  const v2ByRow = new Map<number, ClassificationResult['items'][number]>();
  for (const item of v2Result.items) {
    v2ByRow.set(item.sourceRowIndex + 1, item);
  }

  let upgraded = 0;
  let unmatched = 0;
  for (const parsed of parsedItems) {
    const v2 = v2ByRow.get(parsed.source.rowStart);
    if (!v2) {
      unmatched++;
      continue;
    }
    // v2 wins for classification fields. Legacy values are discarded.
    parsed.rowRole = v2.rowRole;
    parsed.parentItemId = v2.parentItemId;
    parsed.sectionId = v2.sectionId;
    parsed.originalTyp = v2.originalTyp;
    parsed.classificationConfidence = v2.classificationConfidence;
    parsed.classificationSource = v2.classificationSource;
    parsed.source_format = v2.sourceFormat;
    parsed.source_row_index = v2.sourceRowIndex;
    if (v2.por !== null && parsed.por === undefined) parsed.por = v2.por;
    if (v2.cenovaSoustava !== null && parsed.cenovaSoustava === undefined) parsed.cenovaSoustava = v2.cenovaSoustava;
    if (v2.varianta !== null && parsed.varianta === undefined) parsed.varianta = v2.varianta;
    // Preserve raw cells so "Re-classify all" can reconstruct without .xlsx.
    if (v2.rawCells !== undefined) parsed._rawCells = v2.rawCells;
    // Preserve warnings into existing classificationWarnings bucket.
    if (v2.warnings.length > 0) {
      parsed.classificationWarnings = [
        ...(parsed.classificationWarnings ?? []),
        ...v2.warnings,
      ];
    }
    upgraded++;
  }
  return { upgraded, unmatched };
}

/**
 * Build a human-readable diagnostic line from a v2 ClassificationResult for
 * display in the ImportModal warnings panel. Returns null when the result
 * is clean (no orphans, no detection concerns) — caller can skip pushing.
 */
export function summarizeV2Result(
  v2Result: ClassificationResult,
  sheetName: string,
): string | null {
  const parts: string[] = [];
  if (v2Result.orphanCount > 0) {
    parts.push(`${v2Result.orphanCount} orphan subordinate(s) downgraded to unknown`);
  }
  if (v2Result.mapping.detectionConfidence < 0.5) {
    parts.push(`column detection confidence low (${(v2Result.mapping.detectionConfidence * 100).toFixed(0)}%, source: ${v2Result.mapping.detectionSource})`);
  }
  if (v2Result.unknownCount > v2Result.mainCount) {
    parts.push(`${v2Result.unknownCount} unknown rows vs ${v2Result.mainCount} main items — check column mapping`);
  }
  if (parts.length === 0) return null;
  return `[${sheetName}] classifier: ${parts.join('; ')}`;
}

/** Source-context passed into synthetic ParsedItem.source on append. */
export interface SheetContext {
  projectId: string;
  fileName: string;
  sheetName: string;
}

/**
 * Insert synthetic ParsedItem rows for v2 subordinate / section / unknown
 * items that have NO matching row in `parsedItems`. Mutates `parsedItems`
 * in place (sort order is preserved by inserting at the right index based
 * on `source.rowStart`).
 *
 * Motivation: the legacy parser (excelParser.ts:238-288) in its default
 * `standard` mode only creates a ParsedItem when `isItemCode(kod)` is true.
 * EstiCon PP / VV / TS rows and Komplet PP / PSC / VV rows have no kod —
 * they were absorbed into the preceding main's `popisDetail[]`. The v1.1
 * classifier, running on the raw workbook, correctly outputs them as
 * `rowRole: 'subordinate'`, but `mergeV2IntoParsedItems` only UPDATES
 * fields on existing items — it cannot insert. Without this append pass,
 * subordinate rows simply do not appear in the Registry store (empty
 * collapse state under every main).
 *
 * ID-translation contract: classifier assigns its own UUIDs inside the
 * ClassificationResult. These do not match the parser's UUIDs for items
 * that already exist in `parsedItems`. `mergeV2IntoParsedItems` blindly
 * copied `parentItemId` / `sectionId` from v2 into parsed items — those
 * refs were therefore broken (pointed to v2 UUIDs, not any ParsedItem.id
 * in the store). This function builds a v2Id → parsedId map by matching
 * each v2 item to its parsed item via rowStart, uses new UUIDs for the
 * synthetic rows it inserts, and then rewrites every parent/section ref
 * across the combined item list so every link resolves.
 *
 * Side effect on parent mains: when a subordinate is appended beneath a
 * main whose parser previously absorbed that row's text into popisDetail,
 * the main's `popisDetail` is cleared and `popisFull` reset to `popis`.
 * Otherwise the subordinate's text would render twice (once as the
 * subordinate row, once as the parent main's extra description lines).
 *
 * @returns counts for diagnostic display in the ImportModal warnings.
 */
export function appendMissingSubordinates(
  parsedItems: ParsedItem[],
  v2Result: ClassificationResult,
  sheetContext: SheetContext,
): { appended: number; clearedDetail: number } {
  // Index existing parsed items by their 1-based rowStart for O(1) lookup.
  const parsedByRow = new Map<number, ParsedItem>();
  for (const p of parsedItems) parsedByRow.set(p.source.rowStart, p);

  // Build v2.id → parsedItem.id map seeded with already-matched rows
  // (mains that the parser produced). Synthetic rows added below extend
  // this map so downstream v2 refs (parentItemId / sectionId) resolve.
  const v2IdToParsedId = new Map<string, string>();
  for (const v2 of v2Result.items) {
    const matched = parsedByRow.get(v2.sourceRowIndex + 1);
    if (matched) v2IdToParsedId.set(v2.id, matched.id);
  }

  const mapping = v2Result.mapping;

  // Helper: safely pull a cell value from rawCells at a mapped column index.
  const cellAt = (cells: unknown[], col: number | null): unknown =>
    col === null || col < 0 || col >= cells.length ? undefined : cells[col];

  const appended: ParsedItem[] = [];
  // Mains whose popisDetail should be cleared after the append pass (their
  // absorbed text now lives in the appended subordinate rows). Tracked by
  // parsed id so we apply it once even if a main has multiple subs.
  const mainsNeedingDetailClear = new Set<string>();

  // Walk v2 in source order so that sections precede the mains they
  // enclose and mains precede their subordinates — this guarantees any
  // reference we need to translate has already been registered in the map.
  //
  // We synthesize for every non-`empty` role including `main`. The
  // original spec called out only {subordinate, section, unknown} on the
  // assumption that the parser catches every main row — but the parser's
  // `isItemCode(kod)` gate misses mains whose kod is non-standard
  // (e.g. Komplet OTSKP sheets sometimes carry mains with a short text
  // prefix that fails the default regex). Those orphan mains leave
  // appended subordinates with unresolvable parent refs. Including
  // `main` here closes that gap and preserves the "every subordinate
  // has a real parent in the store" invariant.
  for (const v2 of v2Result.items) {
    if (parsedByRow.has(v2.sourceRowIndex + 1)) continue;
    if (
      v2.rowRole !== 'subordinate' &&
      v2.rowRole !== 'section' &&
      v2.rowRole !== 'unknown' &&
      v2.rowRole !== 'main'
    ) continue;

    const cells = v2.rawCells ?? [];
    const kod = String(cellAt(cells, mapping.kod) ?? '').trim();
    const popis = String(cellAt(cells, mapping.popis) ?? '').trim();
    const mj = String(cellAt(cells, mapping.mj) ?? '').trim().toLowerCase();
    const mnozstvi = parseNumber(
      cellAt(cells, mapping.mnozstvi) as string | number | null | undefined,
    );
    const cenaJednotkova = parseNumber(
      cellAt(cells, mapping.cenaJednotkova) as string | number | null | undefined,
    );
    const cenaCelkem = parseNumber(
      cellAt(cells, mapping.cenaCelkem) as string | number | null | undefined,
    );

    const synthId = uuidv4();
    v2IdToParsedId.set(v2.id, synthId);

    const translatedParent = v2.parentItemId
      ? (v2IdToParsedId.get(v2.parentItemId) ?? null)
      : null;
    const translatedSection = v2.sectionId
      ? (v2IdToParsedId.get(v2.sectionId) ?? null)
      : null;

    const synth: ParsedItem = {
      id: synthId,
      kod,
      popis,
      popisDetail: [],
      popisFull: popis,
      mj,
      mnozstvi,
      cenaJednotkova,
      cenaCelkem,
      skupina: null,
      skupinaSuggested: null,
      rowRole: v2.rowRole,
      parentItemId: translatedParent,
      sectionId: translatedSection,
      originalTyp: v2.originalTyp,
      classificationConfidence: v2.classificationConfidence,
      classificationSource: v2.classificationSource,
      source_format: v2.sourceFormat,
      source_row_index: v2.sourceRowIndex,
      por: v2.por,
      cenovaSoustava: v2.cenovaSoustava,
      varianta: v2.varianta,
      _rawCells: v2.rawCells,
      source: {
        projectId: sheetContext.projectId,
        fileName: sheetContext.fileName,
        sheetName: sheetContext.sheetName,
        rowStart: v2.sourceRowIndex + 1,
        rowEnd: v2.sourceRowIndex + 1,
        cellRef: '',
      },
    };

    appended.push(synth);
    parsedByRow.set(synth.source.rowStart, synth);

    if (v2.rowRole === 'subordinate' && translatedParent) {
      mainsNeedingDetailClear.add(translatedParent);
    }
  }

  // Merge appended into the live array and re-sort by rowStart so the
  // final order matches the source Excel row order (consumers such as
  // ItemsTable.effectiveParentMap walk items in source order).
  parsedItems.push(...appended);
  parsedItems.sort((a, b) => a.source.rowStart - b.source.rowStart);

  // Retranslate refs on ALL parsed items — not just appended — so the
  // v2-UUID refs that `mergeV2IntoParsedItems` wrote into existing items
  // now resolve to real ParsedItem.ids. Refs that don't have a mapping
  // entry stay as-is (they were already either null or a pre-merge
  // parser id, which is still valid).
  for (const p of parsedItems) {
    if (p.parentItemId && v2IdToParsedId.has(p.parentItemId)) {
      p.parentItemId = v2IdToParsedId.get(p.parentItemId)!;
    }
    if (p.sectionId && v2IdToParsedId.has(p.sectionId)) {
      p.sectionId = v2IdToParsedId.get(p.sectionId)!;
    }
  }

  // Clear popisDetail on mains whose absorbed text is now carried by the
  // freshly-appended subordinates (otherwise the text renders twice — in
  // the main's expanded detail lines AND in the subordinate rows).
  let clearedDetail = 0;
  for (const p of parsedItems) {
    if (!mainsNeedingDetailClear.has(p.id)) continue;
    if (p.popisDetail.length === 0) continue;
    p.popisDetail = [];
    p.popisFull = p.popis;
    clearedDetail++;
  }

  return { appended: appended.length, clearedDetail };
}
