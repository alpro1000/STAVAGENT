/**
 * Text utilities for search normalization
 */

/**
 * Normalize text for search purposes by:
 * - converting to Unicode NFD form
 * - stripping diacritic marks
 * - collapsing whitespace
 * - converting to uppercase
 *
 * This helps us perform accent-insensitive comparisons in SQLite
 * without requiring ICU extensions.
 */
export function normalizeForSearch(input = '') {
  if (!input) {
    return '';
  }

  return input
    .normalize('NFD')
    // Remove combining diacritic marks
    .replace(/[\u0300-\u036f]/g, '')
    // Collapse multiple whitespace characters to a single space
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Normalize codes for search by stripping non-alphanumeric characters
 * and converting to uppercase. This allows us to search numeric codes
 * regardless of spacing.
 */
export function normalizeCode(input = '') {
  if (!input) {
    return '';
  }

  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

/**
 * Extract part_name from item_name
 *
 * Examples:
 *   "ZÁKLADY ZE ŽELEZOBETONU DO C30/37" → "ZÁKLADY"
 *   "MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37" → "MOSTNÍ OPĚRY A KŘÍDLA"
 *   "MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)" → "MOSTNÍ PILÍŘE A STATIVA"
 *
 * Logic: Extract text before keywords: ZE, Z, DO, Z PROST, NA, POD, V, KD, atd.
 */
export function extractPartName(itemName = '') {
  if (!itemName) {
    return '';
  }

  // Keywords that typically start the specification part
  const separators = [
    'ZE ',
    'Z PROST',
    'Z PŘEDP',
    'Z ',
    'DO ',
    'NA ',
    'POD ',
    'V ',
    'KD '
  ];

  let result = itemName.trim();

  // Find the earliest separator
  let minIndex = itemName.length;
  for (const sep of separators) {
    const index = itemName.toUpperCase().indexOf(sep.toUpperCase());
    if (index > 0 && index < minIndex) {
      minIndex = index;
    }
  }

  // Extract part before separator
  if (minIndex < itemName.length) {
    result = itemName.substring(0, minIndex).trim();
  }

  return result;
}
