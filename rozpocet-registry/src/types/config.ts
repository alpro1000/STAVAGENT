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
  metadataCells: MetadataCells;
  columns: ColumnMapping;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  config: Omit<ImportConfig, 'sheetName'>;  // sheetName выбирается динамически
}

export const DEFAULT_TEMPLATES: ImportTemplate[] = [
  {
    id: 'urs-standard',
    name: 'ÚRS standard',
    description: 'Standardní ÚRS rozpočet',
    config: {
      templateName: 'ÚRS standard',
      dataStartRow: 10,
      metadataCells: {
        projectNumber: 'B2',
        projectName: 'B3',
        oddil: 'C5',
        stavba: 'A1',
      },
      columns: {
        kod: 'A',
        popis: 'B',
        mj: 'C',
        mnozstvi: 'D',
        cenaJednotkova: 'E',
        cenaCelkem: 'F',
      },
    },
  },
  {
    id: 'otskp-standard',
    name: 'OTSKP standard',
    description: 'Standardní OTSKP výkaz výměr',
    config: {
      templateName: 'OTSKP standard',
      dataStartRow: 12,
      metadataCells: {
        projectNumber: 'A2',
        projectName: 'A3',
        oddil: 'B5',
        stavba: 'A1',
      },
      columns: {
        kod: 'A',
        popis: 'B',
        mj: 'D',
        mnozstvi: 'E',
        cenaJednotkova: 'F',
        cenaCelkem: 'G',
      },
    },
  },
];
