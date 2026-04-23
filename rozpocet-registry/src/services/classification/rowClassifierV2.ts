/**
 * Row classifier v2 — top-level orchestrator per ROW_CLASSIFICATION_ALGORITHM v1.1.
 *
 *   raw rows (unknown[][]) + templateHint (optional)
 *        ↓
 *   [1] detectColumns  → ColumnMapping
 *        ↓
 *   [2] classify each row:
 *        if mapping.typ !== null  → classifyTypRow (fast path)
 *        else                     → classifyContentRow (heuristic fallback)
 *        ↓
 *   [3] inferSourceFormat from Typ batch (only when fast path used)
 *        ↓
 *   [4] assignParentLinks    → ClassifiedItem[]
 *        ↓
 *   ClassificationResult
 *
 * This file is the SINGLE new public entry for v1.1. The old
 * rowClassificationService.classifyRows() remains untouched in this PR —
 * integration (commit 6) will swap ImportModal over to this orchestrator.
 * Until then both classifiers live side-by-side: legacy for existing code
 * paths, v2 for new callers and tests.
 */

import { detectColumns } from './columnAutoDetect';
import { classifyTypRow, inferSourceFormat, normalizeTypMarker } from './typColumnClassifier';
import { classifyContentRow } from './contentHeuristicClassifier';
import { assignParentLinks } from './parentLinking';
import type {
  ClassificationResult,
  ClassifiedRowBase,
  ColumnMapping,
  RawRow,
  SourceFormat,
  TemplateHint,
} from './classifierTypes';

export interface ClassifySheetOptions {
  /** Sheet name — preserved into each item's sourceSheetName for traceability. */
  sheetName: string;
  /** Optional template hint from ImportModal preset (urs-standard / otskp / ...). */
  templateHint?: TemplateHint;
  /**
   * Store raw Excel cells on each classified item so the "Re-classify all"
   * button can reconstruct classification later without re-reading the
   * .xlsx. Default true for fresh imports. Legacy reclassify paths without
   * access to raw cells should pass false.
   */
  preserveRawCells?: boolean;
}

/**
 * Classify one sheet end-to-end.
 *
 * @param rows - 2D array of cells as produced by the Excel parser (one entry per
 *               spreadsheet row, each row is an array of cell values in column order).
 * @param options - sheet name + optional template hint + raw-cell-capture flag.
 * @returns ClassificationResult with items, mapping, counters, and warnings.
 */
export function classifySheet(rows: unknown[][], options: ClassifySheetOptions): ClassificationResult {
  const { sheetName, templateHint = null, preserveRawCells = true } = options;

  // Guard against degenerate input.
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      items: [],
      mapping: emptyResultMapping(),
      sheetName,
      sourceFormat: null,
      orphanCount: 0,
      unknownCount: 0,
      sectionCount: 0,
      mainCount: 0,
      subordinateCount: 0,
    };
  }

  // §1. Column auto-detection
  const mapping = detectColumns(rows, templateHint);

  // If detection produced an invalid mapping (no popis column), bail out
  // gracefully — returning zero items prevents the ImportModal from adding
  // garbage to the store and lets the UI surface the failure.
  if (mapping.popis < 0 || mapping.popis >= Math.max(...rows.map(r => r?.length ?? 0))) {
    return {
      items: [],
      mapping,
      sheetName,
      sourceFormat: null,
      orphanCount: 0,
      unknownCount: 0,
      sectionCount: 0,
      mainCount: 0,
      subordinateCount: 0,
    };
  }

  // §2+§3. Per-row classification — start from dataStartRow to skip the
  // header block (Krycí list, Rekapitulace, header row itself).
  const classifiedRows: ClassifiedRowBase[] = [];
  const typValuesForInference: string[] = [];
  const useTypPath = mapping.typ !== null;

  for (let rowIdx = mapping.dataStartRow; rowIdx < rows.length; rowIdx++) {
    const cells = rows[rowIdx];
    if (!Array.isArray(cells)) continue;

    const rawRow: RawRow = {
      cells,
      sourceRowIndex: rowIdx,
      sourceSheetName: sheetName,
    };

    let classified: ClassifiedRowBase | null;
    if (useTypPath) {
      classified = classifyTypRow(rawRow, mapping, null /* sourceFormat filled below */);
      if (classified !== null) {
        typValuesForInference.push(normalizeTypMarker(cells[mapping.typ as number]));
      }
    } else {
      classified = classifyContentRow(rawRow, mapping);
    }

    if (classified === null) continue; // empty row — skip per edge §6.8

    if (preserveRawCells) {
      // Shallow clone cells so future mutations don't leak back into the row.
      classified.rawCells = Array.isArray(cells) ? cells.slice() : [];
    }

    classifiedRows.push(classified);
  }

  // Infer sourceFormat once from the full Typ-value batch, then backfill
  // each classified item. Content-heuristic path already has sourceFormat=null.
  const inferredFormat: SourceFormat | null = useTypPath ? inferSourceFormat(typValuesForInference) : null;
  if (inferredFormat !== null) {
    for (const item of classifiedRows) {
      if (item.classificationSource === 'typ-column') {
        item.sourceFormat = inferredFormat;
      }
    }
  }

  // §4. Parent linking pass.
  const linked = assignParentLinks(classifiedRows);

  // Aggregate counters for the result.
  let sectionCount = 0, mainCount = 0, subordinateCount = 0, unknownCount = 0;
  for (const item of linked.items) {
    switch (item.rowRole) {
      case 'section': sectionCount++; break;
      case 'main': mainCount++; break;
      case 'subordinate': subordinateCount++; break;
      case 'unknown': unknownCount++; break;
    }
  }

  return {
    items: linked.items,
    mapping,
    sheetName,
    sourceFormat: inferredFormat,
    orphanCount: linked.orphanCount,
    unknownCount,
    sectionCount,
    mainCount,
    subordinateCount,
  };
}

/**
 * Classify a whole workbook (Array of sheets). Each sheet gets an
 * independent ColumnMapping and independent currentMainId/currentSectionId
 * tracking per edge §6.13 — cross-sheet parent leaks are NOT allowed.
 */
export function classifyWorkbook(
  sheets: Array<{ name: string; rows: unknown[][] }>,
  options: { templateHint?: TemplateHint; preserveRawCells?: boolean } = {},
): ClassificationResult[] {
  return sheets.map(sheet =>
    classifySheet(sheet.rows, {
      sheetName: sheet.name,
      templateHint: options.templateHint ?? null,
      preserveRawCells: options.preserveRawCells !== false,
    }),
  );
}

function emptyResultMapping(): ColumnMapping {
  return {
    headerRowIndex: null,
    dataStartRow: 0,
    kod: null,
    popis: -1,
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
