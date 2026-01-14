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

  // Трассировка источника
  source: ItemSource;
}
