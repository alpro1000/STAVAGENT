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
