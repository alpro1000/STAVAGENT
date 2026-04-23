/**
 * Rozpočet Registry - Types
 * Item-related type definitions
 */

export interface ItemSource {
  projectId: string;           // ID проекта в registry
  fileName: string;            // имя файла
  sheetName: string;           // имя листа
  rowStart: number;            // первая строка позиции
  rowEnd: number;              // последняя строка (включая описание)
  cellRef: string;             // ссылка на ячейку кода "A15"
}

export interface ParsedItem {
  id: string;                    // уникальный ID (uuid)
  kod: string;                   // код позиции "231112"
  popis: string;                 // основное описание
  popisDetail: string[];         // дополнительные строки описания
  popisFull: string;             // объединённое полное описание
  mj: string;                    // единица измерения
  mnozstvi: number | null;       // количество
  cenaJednotkova: number | null; // цена за единицу
  cenaCelkem: number | null;     // общая цена

  // Классификация
  skupina: string | null;        // назначенная группа
  skupinaSuggested: string | null; // AI-подсказка группы

  // Row classification (additive, backward compatible)
  rowRole?: 'main' | 'subordinate' | 'section' | 'unknown';
  subordinateType?: 'repeat' | 'note' | 'calculation' | 'other';
  parentItemId?: string | null;  // ID of parent main item (for subordinate rows)
  boqLineNumber?: number | null; // Sequential BOQ line number (main items only)
  // Legacy bucket ('high'|'medium'|'low') OR new numeric 0.0-1.0 score per
  // ROW_CLASSIFICATION_ALGORITHM v1.1. Old imports remain on string buckets;
  // fresh imports after classifier rewrite write numeric confidence.
  classificationConfidence?: number | 'high' | 'medium' | 'low';
  classificationWarnings?: string[];

  // New fields from ROW_CLASSIFICATION_ALGORITHM v1.1 (all optional — legacy
  // items in IndexedDB have them undefined; UI fallbacks keep working).
  /** Groups multiple main rows under one section header for future skupina inheritance. */
  sectionId?: string | null;
  /** Producer hint inferred from column auto-detection. Not a gate for classification. */
  source_format?: 'EstiCon' | 'Komplet' | 'RTSROZP' | null;
  /** Original Excel row index (0-based) for debug + re-classify. */
  source_row_index?: number;
  /** Raw Typ column value when present (e.g. 'SD', 'K', 'PP'). Preserves traceability. */
  originalTyp?: string | null;
  /** Poř. číslo from source (main items only). */
  por?: number | null;
  /** Cenová soustava per item ('OTSKP 2025', 'CS ÚRS 2025 02'...). */
  cenovaSoustava?: string | null;
  /** Varianta column — EstiCon only ('kn', 'pvh'...). */
  varianta?: string | null;
  /** Which classifier path produced rowRole. 'rules' = legacy pre-rewrite classifier. */
  classificationSource?: 'typ-column' | 'content-heuristic' | 'ai-fallback' | 'rules';
  /**
   * Raw Excel row cells captured at import time. Enables the "Re-classify all"
   * button to reconstruct classification from scratch without re-reading the
   * .xlsx file. Populated only for items imported after the classifier rewrite;
   * legacy items have this undefined and cannot be re-classified in place.
   */
  _rawCells?: unknown[];

  // Portal PositionInstance link (for DOV write-back)
  position_instance_id?: string | null;

  // Monolit calculation data (read-back from Portal)
  monolith_payload?: MonolithPayload | null;

  // Трассировка источника
  source: ItemSource;
}

/**
 * MonolithPayload — calculation data written by Monolit-Planner to Portal.
 * Read back by Registry to display Monolit results alongside BOQ items.
 * Spec: docs/POSITION_INSTANCE_ARCHITECTURE.ts
 */
export interface MonolithPayload {
  monolit_position_id: string;
  monolit_project_id: string;
  part_name: string;
  monolit_url?: string;
  subtype: string;
  otskp_code?: string | null;
  item_name?: string | null;
  crew_size: number;
  wage_czk_ph: number;
  shift_hours: number;
  days: number;
  labor_hours: number;
  cost_czk: number;
  concrete_m3?: number | null;
  unit_cost_on_m3?: number | null;
  kros_unit_czk?: number | null;
  kros_total_czk?: number | null;
  source_tag: string;
  confidence: number;
  calculated_at: string;

  // Extended cost breakdown from PlannerOutput (P3: TOV pre-fill)
  costs?: {
    formwork_labor_czk: number;
    rebar_labor_czk: number;
    pour_labor_czk: number;
    pour_night_premium_czk: number;
    total_labor_czk: number;
    formwork_rental_czk: number;
    props_labor_czk: number;
    props_rental_czk: number;
  };
  resources?: {
    total_formwork_workers: number;
    total_rebar_workers: number;
    crew_size_formwork: number;
    crew_size_rebar: number;
    shift_h: number;
    wage_formwork_czk_h: number;
    wage_rebar_czk_h: number;
    wage_pour_czk_h: number;
    pour_shifts: number;
  };
  formwork_info?: {
    system_name: string;
    manufacturer: string;
    rental_czk_m2_month: number;
    assembly_days: number;
    disassembly_days: number;
    curing_days: number;
    formwork_area_m2: number;
    num_tacts: number;
    num_sets: number;
  };
  schedule_info?: {
    total_days: number;
    tact_count: number;
  };
}
