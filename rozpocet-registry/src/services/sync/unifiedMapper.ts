/**
 * Rozpočet Registry - Unified Mapper Service
 *
 * Transforms data between Registry's internal format (ParsedItem)
 * and the unified format (UnifiedPosition) for inter-kiosk communication.
 *
 * @see src/types/unified.ts
 * @see docs/UNIFICATION_PLAN.md
 */

import type { ParsedItem } from '../../types/item';
import type { Project, Sheet } from '../../types/project';
import type { UnifiedPosition, UnifiedProject } from '../../types/unified';

// ============================================================================
// REGISTRY → UNIFIED
// ============================================================================

/**
 * Convert a Registry ParsedItem to UnifiedPosition
 */
export function mapItemToUnified(
  item: ParsedItem,
  portalProjectId: string
): UnifiedPosition {
  return {
    // Identifiers
    id: item.id,
    portalProjectId,
    sourceKiosk: 'registry',
    sourceItemId: item.id,

    // Core fields (renamed)
    code: item.kod || null,
    description: item.popisFull || item.popis,
    quantity: item.mnozstvi,
    unit: item.mj || null,
    unitPrice: item.cenaJednotkova,
    totalPrice: item.cenaCelkem,

    // Classification
    category: item.skupina,
    rowRole: item.rowRole || 'unknown',

    // Quality
    confidence: mapConfidenceToNumber(item.classificationConfidence),
    matchSource: item.skupinaSuggested ? 'ai' : item.skupina ? 'manual' : null,

    // Source
    source: {
      fileName: item.source.fileName,
      sheetName: item.source.sheetName,
      rowNumber: item.source.rowStart,
      importedAt: new Date().toISOString(),
    },

    // No TOV or linked calculations by default
    tov: undefined,
    linkedCalculations: undefined,
  };
}

/**
 * Convert all items from a Registry Sheet to UnifiedPositions
 */
export function mapSheetToUnified(
  sheet: Sheet,
  portalProjectId: string
): UnifiedPosition[] {
  return sheet.items.map(item => mapItemToUnified(item, portalProjectId));
}

/**
 * Convert all items from a Registry Project to UnifiedPositions
 */
export function mapProjectToUnified(project: Project): UnifiedPosition[] {
  const portalProjectId = project.portalLink?.portalProjectId || project.id;

  return project.sheets.flatMap(sheet =>
    mapSheetToUnified(sheet, portalProjectId)
  );
}

/**
 * Convert a Registry Project to UnifiedProject
 */
export function mapProjectMetaToUnified(project: Project): UnifiedProject {
  const totalItems = project.sheets.reduce(
    (sum, sheet) => sum + sheet.items.length,
    0
  );
  const totalCost = project.sheets.reduce(
    (sum, sheet) => sum + (sheet.stats.totalCena || 0),
    0
  );

  return {
    portalProjectId: project.portalLink?.portalProjectId || project.id,
    name: project.projectName,
    description: project.fileName,

    status: 'active',
    createdAt: project.importedAt.toISOString(),
    updatedAt: new Date().toISOString(),

    linkedKiosks: {
      registry: project.id,
    },

    summary: {
      totalPositions: totalItems,
      totalCost,
      currency: 'CZK',
    },
  };
}

// ============================================================================
// UNIFIED → REGISTRY
// ============================================================================

/**
 * Convert a UnifiedPosition to Registry ParsedItem
 */
export function mapUnifiedToItem(
  unified: UnifiedPosition,
  registryProjectId: string,
  sheetName: string = 'Import'
): ParsedItem {
  return {
    // Use original ID or generate new
    id: unified.sourceKiosk === 'registry' ? unified.sourceItemId : unified.id,

    // Core fields (renamed back)
    kod: unified.code || '',
    popis: unified.description,
    popisDetail: [],
    popisFull: unified.description,
    mj: unified.unit || '',
    mnozstvi: unified.quantity,
    cenaJednotkova: unified.unitPrice,
    cenaCelkem: unified.totalPrice,

    // Classification
    skupina: unified.category,
    skupinaSuggested: null,

    // Portal PositionInstance link (for cross-kiosk DOV/Monolith write-back)
    position_instance_id: (unified as any).position_instance_id || null,

    // Row classification
    rowRole: unified.rowRole,
    subordinateType: undefined,
    parentItemId: null,
    boqLineNumber: null,
    classificationConfidence: mapNumberToConfidence(unified.confidence),
    classificationWarnings: [],

    // Source
    source: {
      projectId: registryProjectId,
      fileName: unified.source.fileName || 'import',
      sheetName: unified.source.sheetName || sheetName,
      rowStart: unified.source.rowNumber || 0,
      rowEnd: unified.source.rowNumber || 0,
      cellRef: '',
    },
  };
}

/**
 * Convert multiple UnifiedPositions to Registry ParsedItems
 */
export function mapUnifiedToItems(
  positions: UnifiedPosition[],
  registryProjectId: string,
  sheetName: string = 'Import'
): ParsedItem[] {
  return positions.map(pos =>
    mapUnifiedToItem(pos, registryProjectId, sheetName)
  );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert confidence string to number (0-100)
 */
function mapConfidenceToNumber(
  confidence?: 'high' | 'medium' | 'low'
): number | null {
  switch (confidence) {
    case 'high':
      return 90;
    case 'medium':
      return 60;
    case 'low':
      return 30;
    default:
      return null;
  }
}

/**
 * Convert confidence number to string
 */
function mapNumberToConfidence(
  confidence: number | null
): 'high' | 'medium' | 'low' | undefined {
  if (confidence === null || confidence === undefined) return undefined;
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export interface MergeResult {
  imported: number;
  updated: number;
  skipped: number;
  items: ParsedItem[];
}

/**
 * Merge incoming UnifiedPositions with existing ParsedItems
 *
 * Strategies:
 * - 'append': Add all new items, skip duplicates by ID
 * - 'replace': Replace all items in the sheet
 * - 'merge': Update existing items by ID, add new ones
 */
export function mergePositions(
  existing: ParsedItem[],
  incoming: UnifiedPosition[],
  registryProjectId: string,
  sheetName: string,
  strategy: 'append' | 'replace' | 'merge'
): MergeResult {
  const incomingItems = mapUnifiedToItems(incoming, registryProjectId, sheetName);

  switch (strategy) {
    case 'replace':
      return {
        imported: incomingItems.length,
        updated: 0,
        skipped: 0,
        items: incomingItems,
      };

    case 'append': {
      const existingIds = new Set(existing.map(item => item.id));
      const newItems = incomingItems.filter(item => !existingIds.has(item.id));
      return {
        imported: newItems.length,
        updated: 0,
        skipped: incomingItems.length - newItems.length,
        items: [...existing, ...newItems],
      };
    }

    case 'merge': {
      const existingMap = new Map(existing.map(item => [item.id, item]));
      let imported = 0;
      let updated = 0;

      for (const item of incomingItems) {
        if (existingMap.has(item.id)) {
          // Update existing
          existingMap.set(item.id, {
            ...existingMap.get(item.id)!,
            ...item,
          });
          updated++;
        } else {
          // Add new
          existingMap.set(item.id, item);
          imported++;
        }
      }

      return {
        imported,
        updated,
        skipped: 0,
        items: Array.from(existingMap.values()),
      };
    }

    default:
      return {
        imported: 0,
        updated: 0,
        skipped: incomingItems.length,
        items: existing,
      };
  }
}
