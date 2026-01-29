/**
 * RowPack Builder - Builds context for AI classification
 * Combines MAIN item + CHILD items (subordinates) into single context
 */

import type { ParsedItem, RowPack } from './types';
import * as crypto from 'crypto';

const MAX_CHILD_TEXT_LENGTH = 6000; // Limit to avoid huge prompts
const MAX_MAIN_TEXT_LENGTH = 2000;

/**
 * Build RowPack for a main item with its subordinates
 */
export function buildRowPack(
  mainItem: ParsedItem,
  subordinates: ParsedItem[]
): RowPack {
  // Build main text
  const mainText = buildMainText(mainItem);

  // Build child text (context)
  const childText = buildChildText(subordinates);

  // Create hash for caching
  const hash = createHash(mainText, childText);

  return {
    main_text: mainText,
    child_text: childText,
    meta: {
      itemId: mainItem.id,
      kod: mainItem.kod,
      projectId: mainItem.source.projectId,
      sheetId: mainItem.source.sheetId,
      rowNumber: mainItem.source.rowStart,
      language: detectLanguage(mainItem.popis),
    },
    hash,
  };
}

/**
 * Build compact main text description
 */
function buildMainText(item: ParsedItem): string {
  const parts: string[] = [];

  // Code
  if (item.kod) {
    parts.push(`[${item.kod}]`);
  }

  // Description
  const desc = (item.popisFull || item.popis || '').trim();
  parts.push(desc);

  // Unit + Quantity
  if (item.mj || item.mnozstvi) {
    const unit = item.mj || '?';
    const qty = item.mnozstvi?.toFixed(2) || '?';
    parts.push(`(${qty} ${unit})`);
  }

  let text = parts.join(' ');

  // Truncate if too long
  if (text.length > MAX_MAIN_TEXT_LENGTH) {
    text = text.substring(0, MAX_MAIN_TEXT_LENGTH) + '...';
  }

  return text;
}

/**
 * Build child text from subordinates (context only)
 */
function buildChildText(subordinates: ParsedItem[]): string {
  if (!subordinates || subordinates.length === 0) {
    return '';
  }

  const childTexts = subordinates
    .map(child => {
      const desc = (child.popisFull || child.popis || '').trim();
      // Skip empty or very short descriptions
      if (!desc || desc.length < 3) return null;

      // Add prefix for different types
      let prefix = '';
      if (desc.startsWith('PP')) prefix = '[PP] ';
      else if (desc.startsWith('PSC')) prefix = '[PSC] ';
      else if (desc.startsWith('VV')) prefix = '[VV] ';
      else if (/^[AB]\d+/.test(desc)) prefix = '[Výpočet] ';

      return prefix + desc;
    })
    .filter(Boolean)
    .join('\n');

  // Truncate if too long
  if (childTexts.length > MAX_CHILD_TEXT_LENGTH) {
    return childTexts.substring(0, MAX_CHILD_TEXT_LENGTH) + '\n...';
  }

  return childTexts;
}

/**
 * Create hash for caching (deterministic)
 */
function createHash(mainText: string, childText: string): string {
  const content = `${mainText}|||${childText}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Detect language (simple heuristic)
 */
function detectLanguage(text: string): 'cs' | 'sk' {
  // Simple heuristic: check for Slovak-specific patterns
  const slovakPatterns = /chodník|vozovka|štrk|náter/i;
  return slovakPatterns.test(text) ? 'sk' : 'cs';
}

/**
 * Extract subordinates for a main item from sorted items array
 */
export function extractSubordinates(
  mainItem: ParsedItem,
  allItems: ParsedItem[]
): ParsedItem[] {
  // Sort by row position
  const sorted = [...allItems].sort((a, b) => a.source.rowStart - b.source.rowStart);

  // Find main item index
  const mainIndex = sorted.findIndex(item => item.id === mainItem.id);
  if (mainIndex === -1) return [];

  // Collect subordinates until next main item
  const subordinates: ParsedItem[] = [];

  for (let i = mainIndex + 1; i < sorted.length; i++) {
    const item = sorted[i];

    // Check if this is another main item
    const isMain = item.rowRole
      ? (item.rowRole === 'main' || item.rowRole === 'section')
      : isMainCodeHeuristic(item.kod);

    if (isMain) break;

    subordinates.push(item);
  }

  return subordinates;
}

/**
 * Heuristic to check if code represents main item
 */
function isMainCodeHeuristic(kod: string): boolean {
  if (!kod) return false;

  // Main codes: 6+ digits, no letters
  // Subordinate codes: A195, B5, formulas, etc.
  const mainPattern = /^\d{6,}$/;
  return mainPattern.test(kod.trim());
}
