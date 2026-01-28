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

  // Трассировка источника
  source: ItemSource;
}
