/**
 * Row Classification Service
 *
 * Classifies parsed BOQ items into main vs subordinate rows,
 * assigns parent-child relationships, and adds sequential BOQ line numbers.
 *
 * Row roles:
 *   - main:        Item with a recognized code (6+ digits, OTSKP, RTS)
 *   - subordinate: Description continuation, note, calculation, or repeat row
 *   - section:     Section/group header row (no code, no numeric data, bold-like text)
 *   - unknown:     Cannot determine role
 *
 * Subordinate types:
 *   - repeat:      Row repeats parent code pattern (e.g. A195, B5 sub-indices)
 *   - note:        Textual note or specification detail (no quantities)
 *   - calculation: Row with numeric data but no recognized code (quantity breakdown)
 *   - other:       Doesn't match any specific subordinate pattern
 */

import type { ParsedItem } from '../../types/item';

export interface ClassificationResult {
  items: ParsedItem[];
  stats: ClassificationStats;
}

export interface ClassificationStats {
  totalItems: number;
  mainItems: number;
  subordinateItems: number;
  sectionItems: number;
  unknownItems: number;
  maxBoqLineNumber: number;
}

/* ============================================
   CODE DETECTION PATTERNS
   (Mirrors excelParser.ts isItemCode logic)
   ============================================ */

/** ÚRS codes: 6+ digits (231112) */
const URS_CODE = /^\d{6,}$/;

/** ÚRS dotted: 23.11.12 */
const URS_DOTTED = /^\d{2,3}\.\d{2,3}\.\d{2,3}$/;

/** OTSKP codes: letter + 5+ digits (A12345) */
const OTSKP_CODE = /^[A-Z]\d{5,}$/;

/** RTS codes: XXX-YYY (123-456) */
const RTS_CODE = /^\d{3,4}-\d{3,4}$/;

/** Generic: starts with 3+ digits */
const GENERIC_CODE = /^\d{3,}/;

/** Sub-index pattern: letter + 1-3 digits (A195, B5, C12) — subordinate repeat */
const SUB_INDEX = /^[A-Z]\d{1,3}$/;

/** VV (Výkaz výměr) / PP / PSC explicit markers — always subordinate */
const VV_MARKERS = /^(VV|PP|PSC|VRN)$/i;

/** Multiplication with decimals in description: 15,200*0,030 or 5.2*0.06 */
const DECIMAL_MULTIPLICATION = /\d+[,\.]\d+\s*\*\s*\d+[,\.]\d+/;

/** Summary/total quantity keywords */
const SUMMARY_KEYWORDS = /celkov[éá]\s+množstv[ií]/i;

/** Section header patterns: "Díl:", "HSV", "PSV", "Oddíl", numbered sections like "1.", "2." */
const SECTION_PATTERNS = [
  /^díl\s*[:\.]/i,
  /^oddíl\s*[:\.]/i,
  /^(HSV|PSV|MON|VRN|ON)\b/i,
  /^(práce\s+HSV|práce\s+PSV)/i,
  /^\d{1,2}\s*[\.\)]\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/,  // "1. Zemní práce"
  /^[IVX]+\.\s+/i,                                // Roman numerals "I. ", "IV. "
];

/** Calculation indicators: contains math or quantity expressions */
const CALC_INDICATORS = [
  /\d+[\*×x]\d+/i,       // multiplication: 5*3, 5×3, 5x3
  /\d+\s*[\+\-]\s*\d+/,  // addition/subtraction: 5+3, 10-2
  /\(\d+/,                // parenthesized numbers: (5.2+...
  /\d+\.\d+\s*\*/,        // decimal multiplication: 5.2*
  /=\s*\d+/,              // equals result: = 15
  /celkem/i,              // "celkem" (total)
  /mezisoučet/i,          // subtotal
  /součet/i,              // sum
];

/* ============================================
   CLASSIFICATION LOGIC
   ============================================ */

/**
 * Check if a code string represents a recognized main item code.
 */
function isMainCode(kod: string): boolean {
  if (!kod) return false;
  const trimmed = kod.trim();
  if (!trimmed) return false;

  return (
    URS_CODE.test(trimmed) ||
    URS_DOTTED.test(trimmed) ||
    OTSKP_CODE.test(trimmed) ||
    RTS_CODE.test(trimmed) ||
    GENERIC_CODE.test(trimmed)
  );
}

/**
 * Check if the code looks like a sub-index (A195, B5, etc.)
 */
function isSubIndex(kod: string): boolean {
  if (!kod) return false;
  return SUB_INDEX.test(kod.trim());
}

/**
 * Check if the description text looks like a section header.
 */
function isSectionHeader(popis: string): boolean {
  if (!popis) return false;
  const trimmed = popis.trim();
  return SECTION_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if the row looks like a calculation/breakdown line.
 * A calculation row has no code but contains numeric expressions or quantities.
 */
function isCalculationRow(item: ParsedItem): boolean {
  const popis = item.popis || '';
  // Must have some description text
  if (!popis.trim()) return false;

  // Check description for calculation indicators
  if (CALC_INDICATORS.some(pattern => pattern.test(popis))) {
    return true;
  }

  // Has quantity but no code — likely a quantity breakdown
  if (item.mnozstvi !== null && item.mnozstvi !== 0 && !item.kod?.trim()) {
    return true;
  }

  return false;
}

/**
 * Check if a row is a note/specification detail.
 * A note has text but no numeric data (no quantity, no price).
 */
function isNoteRow(item: ParsedItem): boolean {
  const popis = item.popis?.trim() || '';
  if (!popis) return false;

  // No numeric data at all
  const hasNumbers = (
    (item.mnozstvi !== null && item.mnozstvi !== 0) ||
    (item.cenaJednotkova !== null && item.cenaJednotkova !== 0) ||
    (item.cenaCelkem !== null && item.cenaCelkem !== 0)
  );

  return !hasNumbers;
}

/**
 * Determine confidence level based on classification signals.
 */
function determineConfidence(
  item: ParsedItem,
  role: 'main' | 'subordinate' | 'section' | 'unknown'
): 'high' | 'medium' | 'low' {
  if (role === 'main') {
    const kod = item.kod?.trim() || '';
    // Strong code patterns → high confidence
    if (URS_CODE.test(kod) || OTSKP_CODE.test(kod) || RTS_CODE.test(kod)) {
      return 'high';
    }
    // Dotted or generic → medium
    if (URS_DOTTED.test(kod) || GENERIC_CODE.test(kod)) {
      return 'medium';
    }
    return 'low';
  }

  if (role === 'section') {
    return 'high'; // Section patterns are distinctive
  }

  if (role === 'subordinate') {
    // VV/PP/PSC markers are explicit
    if (VV_MARKERS.test((item.kod || '').trim())) return 'high';
    // Sub-index is clear
    if (isSubIndex(item.kod || '')) return 'high';
    // Decimal multiplication is clear VV pattern
    if (DECIMAL_MULTIPLICATION.test(item.popis || '')) return 'high';
    // Summary keyword is clear
    if (SUMMARY_KEYWORDS.test(item.popis || '')) return 'high';
    // Note with no data is clear
    if (isNoteRow(item)) return 'high';
    // Calculation with explicit patterns is clear
    if (CALC_INDICATORS.some(p => p.test(item.popis || ''))) return 'medium';
    return 'medium';
  }

  return 'low'; // unknown
}

/* ============================================
   MAIN CLASSIFICATION FUNCTION
   ============================================ */

/**
 * Classify all items in a sheet, assigning row roles,
 * parent-child relationships, and BOQ line numbers.
 *
 * Items must be in row order (sorted by source.rowStart).
 */
export function classifyRows(items: ParsedItem[]): ClassificationResult {
  if (items.length === 0) {
    return {
      items: [],
      stats: {
        totalItems: 0,
        mainItems: 0,
        subordinateItems: 0,
        sectionItems: 0,
        unknownItems: 0,
        maxBoqLineNumber: 0,
      },
    };
  }

  // Sort by row position to ensure correct parent-child linking
  const sorted = [...items].sort((a, b) => a.source.rowStart - b.source.rowStart);

  let boqCounter = 0;
  let currentMainId: string | null = null;
  let mainCount = 0;
  let subCount = 0;
  let sectionCount = 0;
  let unknownCount = 0;

  const classified = sorted.map((item) => {
    const kod = item.kod?.trim() || '';
    const popis = item.popis?.trim() || '';
    const warnings: string[] = [];

    let role: 'main' | 'subordinate' | 'section' | 'unknown';
    let subordinateType: 'repeat' | 'note' | 'calculation' | 'other' | undefined;
    let parentItemId: string | null = null;
    let boqLineNumber: number | null = null;

    // 0. Check for explicit VV/PP/PSC/VRN markers — always subordinate
    if (VV_MARKERS.test(kod)) {
      role = 'subordinate';
      subordinateType = 'other';
      parentItemId = currentMainId;
      subCount++;
    }
    // 0b. Check if description is VV-like (decimal multiplication or summary keyword)
    else if (!kod && currentMainId && (DECIMAL_MULTIPLICATION.test(popis) || SUMMARY_KEYWORDS.test(popis))) {
      role = 'subordinate';
      subordinateType = 'calculation';
      parentItemId = currentMainId;
      subCount++;
    }
    // 1. Check if it's a recognized main code
    else if (isMainCode(kod)) {
      role = 'main';
      boqCounter++;
      boqLineNumber = boqCounter;
      currentMainId = item.id;
      mainCount++;
    }
    // 2. Check if it's a sub-index (A195, B5, etc.)
    else if (isSubIndex(kod)) {
      role = 'subordinate';
      subordinateType = 'repeat';
      parentItemId = currentMainId;
      subCount++;

      if (!currentMainId) {
        warnings.push('Sub-index row without preceding main item');
      }
    }
    // 3. Check for section header (no code, distinctive text pattern)
    else if (!kod && isSectionHeader(popis)) {
      role = 'section';
      currentMainId = null; // Section breaks parent chain
      sectionCount++;
    }
    // 4. No code — check if subordinate to current main
    else if (!kod && currentMainId) {
      role = 'subordinate';
      parentItemId = currentMainId;
      subCount++;

      // Determine subordinate type
      if (isCalculationRow(item)) {
        subordinateType = 'calculation';
      } else if (isNoteRow(item)) {
        subordinateType = 'note';
      } else {
        subordinateType = 'other';
      }
    }
    // 5. Has some code-like text but doesn't match main patterns
    else if (kod && !isMainCode(kod) && currentMainId) {
      role = 'subordinate';
      subordinateType = 'other';
      parentItemId = currentMainId;
      subCount++;
      warnings.push(`Unrecognized code format: "${kod}"`);
    }
    // 6. Cannot determine
    else {
      role = 'unknown';
      unknownCount++;

      if (!kod && !popis) {
        warnings.push('Empty row (no code and no description)');
      }
    }

    const confidence = determineConfidence(item, role);

    return {
      ...item,
      rowRole: role,
      subordinateType,
      parentItemId,
      boqLineNumber,
      classificationConfidence: confidence,
      classificationWarnings: warnings.length > 0 ? warnings : undefined,
    };
  });

  return {
    items: classified,
    stats: {
      totalItems: classified.length,
      mainItems: mainCount,
      subordinateItems: subCount,
      sectionItems: sectionCount,
      unknownItems: unknownCount,
      maxBoqLineNumber: boqCounter,
    },
  };
}
