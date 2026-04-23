/**
 * Row classifier types — ROW_CLASSIFICATION_ALGORITHM v1.1.
 *
 * These types are the contract between (1) the column auto-detection pass,
 * (2) the two classification paths (Typ-column fast-path + content-heuristic
 * fallback), and (3) the parent-linking pass.
 *
 * `ClassifiedItem` is the output shape. It does NOT replace `ParsedItem` —
 * ParsedItem is the project-wide item model that includes storage, sync, and
 * UI-facing fields. ClassifiedItem is a projection of the classification
 * algorithm's output that callers merge into a ParsedItem (see
 * rowClassificationService.classifyRows).
 */

/** Producer signature inferred from column auto-detection. Informational hint, not a gate. */
export type SourceFormat = 'EstiCon' | 'Komplet' | 'RTSROZP';

export type RowRole = 'main' | 'subordinate' | 'section' | 'unknown';

export type ClassificationSource =
  | 'typ-column'         // fast-path: producer gave us an explicit Typ column
  | 'content-heuristic'  // fallback: kod/mj/mnozstvi pattern analysis
  | 'ai-fallback'        // reserved for future LLM-assist (out of scope)
  | 'rules';             // legacy classifier (pre-rewrite)

/**
 * Template hint passed into column auto-detection when the user picked a
 * preset in ImportModal (urs-standard / otskp / rts / flexible / svodny).
 * Hints accelerate detection; auto-detection must work without them.
 */
export type TemplateHint =
  | 'esticon'
  | 'komplet'
  | 'urs-standard'
  | 'otskp'
  | 'rts'
  | 'flexible'
  | 'svodny'
  | null;

/**
 * Column mapping resolved by auto-detection for one sheet.
 *
 * `popis` is required (every sheet must have a description column — otherwise
 * there's nothing to classify). All other column indices are nullable: the
 * classifier downgrades rows with missing required fields to 'unknown' instead
 * of failing the import.
 */
export interface ColumnMapping {
  headerRowIndex: number | null;    // null when content-heuristic detection
  dataStartRow: number;             // first row of actual data
  kod: number | null;
  popis: number;                    // REQUIRED
  mj: number | null;
  mnozstvi: number | null;
  cenaJednotkova: number | null;
  cenaCelkem: number | null;
  typ: number | null;               // fast-path trigger when non-null
  por: number | null;               // Poř. číslo (EstiCon)
  cenovaSoustava: number | null;
  varianta: number | null;          // EstiCon-only
  detectionConfidence: number;      // 0.0 — 1.0
  detectionSource: 'header-match' | 'content-heuristic' | 'template-hint';
}

/** Raw row fed into the classifier from the Excel parser. */
export interface RawRow {
  /** Original cells from Excel in the sheet's column order. */
  cells: unknown[];
  /** 0-based row index in the source sheet. Preserved into `source_row_index`. */
  sourceRowIndex: number;
  /** Sheet name for traceability. */
  sourceSheetName: string;
}

/** Output of the classifier for a single row, before parent-linking pass. */
export interface ClassifiedRowBase {
  /** Generated UUID, stable for this classification pass. */
  id: string;
  rowRole: RowRole;
  originalTyp: string | null;
  classificationConfidence: number;    // 0.0 — 1.0
  classificationSource: ClassificationSource;

  // Extracted fields
  por: number | null;
  kod: string | null;
  popis: string;
  mj: string | null;
  mnozstvi: number | null;
  cenaJednotkova: number | null;
  cenaCelkem: number | null;
  cenovaSoustava: string | null;
  varianta: string | null;

  // Traceability
  sourceRowIndex: number;
  sourceSheetName: string;
  sourceFormat: SourceFormat | null;

  // Raw cells preserved for Re-classify-all button (opt-in; undefined on legacy).
  rawCells?: unknown[];
}

/** Final output of classifier after parent-linking pass. */
export interface ClassifiedItem extends ClassifiedRowBase {
  parentItemId: string | null;   // → main's id when rowRole=subordinate
  sectionId: string | null;      // → section's id for grouping
  warnings: string[];            // per-row warnings (orphan downgrade, missing field, ...)
}

/** Result of a full classification pass over one sheet. */
export interface ClassificationResult {
  items: ClassifiedItem[];
  mapping: ColumnMapping;
  sheetName: string;
  sourceFormat: SourceFormat | null;
  orphanCount: number;             // number of subordinates downgraded to unknown
  unknownCount: number;             // total rows classified as 'unknown'
  sectionCount: number;
  mainCount: number;
  subordinateCount: number;
}
