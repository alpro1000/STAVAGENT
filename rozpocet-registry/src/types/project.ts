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
import type {
  ColumnMapping as ClassifierColumnMapping,
  TemplateHint,
} from '../services/classification/classifierTypes';

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

  /**
   * ColumnMapping resolved by the v1.1 classifier at import time. Persisted
   * so `reclassifySheet()` can skip `detectColumns()` (the header row is
   * already consumed by the parser and absent from the reconstructed
   * `_rawCells` stream). Undefined for sheets imported before persistence
   * was introduced — reclassify falls back to content-heuristic detection.
   */
  classifierMapping?: ClassifierColumnMapping;
  /**
   * TemplateHint used at import time (derived from the ImportModal preset).
   * Secondary fallback for reclassify when the full mapping is absent.
   */
  classifierTemplateHint?: TemplateHint;
}

/**
 * Portal link status - connection to stavagent-portal
 */
export interface PortalLink {
  portalProjectId: string;       // UUID from Portal
  linkedAt: Date;                // when linked
  portalProjectName?: string;    // optional cached Portal project name
  lastSyncedAt?: Date;           // last sync timestamp
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

  // Portal integration (optional)
  portalLink?: PortalLink;       // connection to stavagent-portal
}
