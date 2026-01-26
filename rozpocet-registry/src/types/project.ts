/**
 * Rozpočet Registry - Types
 * Project-related type definitions
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

export interface ProjectStats {
  totalItems: number;
  classifiedItems: number;
  totalCena: number;
}

export interface Project {
  id: string;                    // уникальный ID
  fileName: string;              // имя исходного файла
  filePath: string;              // путь к файлу (для ссылок)
  importedAt: Date;              // дата импорта

  metadata: ProjectMetadata;
  config: ImportConfig;          // использованная конфигурация
  items: ParsedItem[];           // распарсенные позиции
  stats: ProjectStats;
}
