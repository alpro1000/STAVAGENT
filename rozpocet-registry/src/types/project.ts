/**
 * Rozpočet Registry - Types
 * Project-related type definitions
 *
 * Hierarchy:
 *   Project (container)
 *     └── Sheet[] (individual Excel sheets)
 *           └── ParsedItem[] (work items)
 */

import type { ParsedItem } from './item';
import type { ImportConfig } from './config';

export interface ProjectMetadata {
  projectNumber: string;       // "SO 201-1"
  projectName: string;         // "Most přes Vltavu"
  oddil: string;               // "Spodní stavba"
  stavba: string;              // "D35 Opatovice"
  sheetName?: string;          // Excel sheet name (for multi-sheet imports)
  custom: Record<string, string>; // дополнительные поля
}

export interface SheetStats {
  totalItems: number;
  classifiedItems: number;
  totalCena: number;
}

/**
 * Sheet - individual Excel sheet within a project
 * (Previously called "Project")
 */
export interface Sheet {
  id: string;                    // UUID листа
  name: string;                  // "SO 12-00", "SO 12-01"
  projectId: string;             // ID родительского проекта

  items: ParsedItem[];           // позиции этого листа
  stats: SheetStats;             // статистика листа
  metadata: ProjectMetadata;     // метаданные листа
  config: ImportConfig;          // использованная конфигурация
}

/**
 * Project - container for multiple sheets from same Excel file
 */
export interface Project {
  id: string;                    // UUID проекта
  fileName: string;              // имя исходного файла "Most_Vltava.xlsx"
  projectName: string;           // название проекта "Most přes Vltavu"
  filePath: string;              // путь к файлу (для ссылок)
  importedAt: Date;              // дата импорта

  sheets: Sheet[];               // массив листов проекта
}
