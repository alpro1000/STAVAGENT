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
  classificationConfidence?: 'high' | 'medium' | 'low';
  classificationWarnings?: string[];

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
}
