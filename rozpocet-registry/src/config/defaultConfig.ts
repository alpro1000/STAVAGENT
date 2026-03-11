/**
 * Default Import Configuration
 *
 * Base configuration for import templates
 */

import type { ImportConfig } from '../types/config';

/**
 * Default import configuration
 * Used as base for all templates
 */
export const defaultImportConfig: Omit<ImportConfig, 'sheetName' | 'sheetIndex'> = {
  templateName: 'default',
  dataStartRow: 2,
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
};
