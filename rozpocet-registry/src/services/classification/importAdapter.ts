/**
 * Import-adapter helpers — bridge between the ImportModal / legacy parser
 * pipeline and the v1.1 classifier (rowClassifierV2).
 *
 * Three responsibilities:
 *   1. extractRawRows(workbook, sheetName)   — pull XLSX sheet into a 2D
 *      array of raw cell values, ready for classifySheet().
 *   2. getTemplateHint(templateType)          — map ImportModal template
 *      enum to the classifier's TemplateHint.
 *   3. mergeV2IntoParsedItems(parsedItems, v2) — additive upgrade of each
 *      ParsedItem with the classifier's row-role/parent/section/rawCells
 *      fields, matched by source.rowStart ↔ sourceRowIndex+1.
 *
 * Design note — "additive upgrade" keeps legacy classifyRows() output
 * intact as a fallback when v2 classifier doesn't produce a matching row
 * (e.g. parser's flexibleMode kept a row that v2's detectColumns skipped
 * as header). This is intentional for the migration PR: once integration
 * tests on all three fixtures pass cleanly, a follow-up PR can remove
 * the legacy classifier entirely.
 */

import * as XLSX from 'xlsx';
import type { ParsedItem } from '../../types';
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
