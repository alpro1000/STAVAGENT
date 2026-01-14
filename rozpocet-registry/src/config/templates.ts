/**
 * Predefined Import Templates
 *
 * Phase 2: Built-in templates for common Excel formats (ÚRS, OTSKP, RTS)
 */

import type { ImportTemplate } from '../types/template';
import { defaultImportConfig } from './defaultConfig';

/**
 * Standard ÚRS Template
 * Most common format for Czech construction BOQ
 */
export const TEMPLATE_URS_STANDARD: ImportTemplate = {
  metadata: {
    id: 'template-urs-standard',
    name: 'Standardní ÚRS',
    type: 'urs-standard',
    description: 'Standardní formát ÚRS s kódem, popisem, MJ, množstvím a cenami',
    icon: '📋',
  },
  config: {
    ...defaultImportConfig,
    templateName: 'Standardní ÚRS',
    sheetName: '',        // Will be set dynamically
    sheetIndex: 0,        // First sheet (default)
    columns: {
      kod: 'A',           // Column A: Code
      popis: 'B',         // Column B: Description
      mj: 'C',            // Column C: Unit
      mnozstvi: 'D',      // Column D: Quantity
      cenaJednotkova: 'E', // Column E: Unit price
      cenaCelkem: 'F',    // Column F: Total price
    },
    dataStartRow: 2,      // Usually header in row 1, data from row 2
  },
  isBuiltIn: true,
  canEdit: false,
  canDelete: false,
};

/**
 * OTSKP Catalog Template
 * Format from official OTSKP catalog exports
 */
export const TEMPLATE_OTSKP: ImportTemplate = {
  metadata: {
    id: 'template-otskp',
    name: 'OTSKP Katalog',
    type: 'otskp',
    description: 'Formát z oficiálního OTSKP katalogu (kód začíná písmenem)',
    icon: '📚',
  },
  config: {
    ...defaultImportConfig,
    templateName: 'OTSKP Katalog',
    sheetName: '',        // Will be set dynamically
    sheetIndex: 0,
    columns: {
      kod: 'A',           // OTSKP codes start with letter (A12345)
      popis: 'B',
      mj: 'D',            // Unit in column D
      mnozstvi: 'E',
      cenaJednotkova: 'F',
      cenaCelkem: 'G',
    },
    dataStartRow: 3,      // OTSKP exports often have 2-row header
  },
  isBuiltIn: true,
  canEdit: false,
  canDelete: false,
};

/**
 * RTS Template
 * Format for RTS (Rámcové technické standardy) documents
 */
export const TEMPLATE_RTS: ImportTemplate = {
  metadata: {
    id: 'template-rts',
    name: 'RTS Standard',
    type: 'rts',
    description: 'Formát RTS s kódem ve formátu XXX-YYY',
    icon: '⚙️',
  },
  config: {
    ...defaultImportConfig,
    templateName: 'RTS Standard',
    sheetName: '',        // Will be set dynamically
    sheetIndex: 0,
    columns: {
      kod: 'A',           // RTS codes: 123-456
      popis: 'C',         // Description in column C
      mj: 'E',
      mnozstvi: 'F',
      cenaJednotkova: 'G',
      cenaCelkem: 'H',
    },
    dataStartRow: 2,
  },
  isBuiltIn: true,
  canEdit: false,
  canDelete: false,
};

/**
 * All predefined templates
 */
export const PREDEFINED_TEMPLATES: ImportTemplate[] = [
  TEMPLATE_URS_STANDARD,
  TEMPLATE_OTSKP,
  TEMPLATE_RTS,
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ImportTemplate | undefined {
  return PREDEFINED_TEMPLATES.find(t => t.metadata.id === id);
}

/**
 * Get template by type
 */
export function getTemplateByType(type: string): ImportTemplate | undefined {
  return PREDEFINED_TEMPLATES.find(t => t.metadata.type === type);
}

/**
 * Get default template (Standard ÚRS)
 */
export function getDefaultTemplate(): ImportTemplate {
  return TEMPLATE_URS_STANDARD;
}
