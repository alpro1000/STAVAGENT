/**
 * Import Template Type Definitions
 *
 * Phase 2: Import configurator with predefined and custom templates
 */

import type { ImportConfig } from './config';

/**
 * Predefined template types
 */
export type TemplateType = 'urs-standard' | 'otskp' | 'rts' | 'custom' | 'flexible' | 'svodny' | 'raw';

/**
 * Template metadata
 */
export interface TemplateMetadata {
  id: string;                    // UUID
  name: string;                  // "Standardní ÚRS" / "OTSKP katalog" / custom name
  type: TemplateType;
  description?: string;          // Template description
  icon?: string;                 // Emoji or icon name
  createdAt?: Date;
  lastUsed?: Date;
}

/**
 * Complete import template
 */
export interface ImportTemplate {
  metadata: TemplateMetadata;
  config: ImportConfig;          // Column mapping and settings
  isBuiltIn: boolean;            // Built-in vs user-created
  canEdit: boolean;              // Whether template can be modified
  canDelete: boolean;            // Whether template can be deleted
}

/**
 * Template selector item for UI
 */
export interface TemplateSelectorItem {
  template: ImportTemplate;
  isSelected: boolean;
  matchScore?: number;           // Auto-detect match score (0-100)
}
