/**
 * Rozpočet Registry - Types
 * Import configuration type definitions
 */

export interface MetadataCells {
  projectNumber?: string;      // "B2"
  projectName?: string;        // "B3"
  oddil?: string;              // "C5"
  stavba?: string;             // "A1"
  [key: string]: string | undefined;  // custom metadata cells
}

export interface ColumnMapping {
  kod: string;                 // "A"
  popis: string;               // "B"
  mj: string;                  // "C"
  mnozstvi: string;            // "D"
  cenaJednotkova: string;      // "E"
  cenaCelkem: string;          // "F"
}

export interface ImportConfig {
  templateName: string;        // "URS_standard", "OTSKP_standard", etc.
  sheetName: string;           // имя листа для импорта
  dataStartRow: number;        // строка начала данных (1-based)
  sheetIndex: number;          // индекс листа (0-based)
  metadataCells: MetadataCells;
  columns: ColumnMapping;
  flexibleMode?: boolean;      // гибкий режим: парсить ВСЕ строки, даже без стандартных кодов
}

// NOTE: ImportTemplate definition moved to ./template.ts
// Use PREDEFINED_TEMPLATES from ../config/templates.ts instead of DEFAULT_TEMPLATES
