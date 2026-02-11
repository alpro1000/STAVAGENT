/**
 * Shared string similarity utilities
 * Consolidated from ursMatcher.js, ursLocalMatcher.js, documentExtractionService.js
 *
 * @module utils/similarity
 */

/**
 * Calculate Levenshtein distance between two strings
 * Uses optimized single-row DP approach (O(n) memory)
 *
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(s1, s2) {
  const len1 = s1.length;
  const len2 = s2.length;

  // Use shorter string for column to minimize memory
  if (len1 < len2) {
    return levenshteinDistance(s2, s1);
  }

  let previousRow = Array(len2 + 1);
  for (let j = 0; j <= len2; j++) {
    previousRow[j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    let currentRow = [i];
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        currentRow[j - 1] + 1,      // insertion
        previousRow[j] + 1,          // deletion
        previousRow[j - 1] + cost    // substitution
      );
    }
    previousRow = currentRow;
  }

  return previousRow[len2];
}

/**
 * Calculate string similarity (0.0 to 1.0) using Levenshtein distance
 * 1.0 = identical strings, 0.0 = completely different
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {boolean} [caseSensitive=false] - Whether comparison is case-sensitive
 * @returns {number} Similarity score between 0.0 and 1.0
 */
export function calculateSimilarity(str1, str2, caseSensitive = false) {
  const s1 = caseSensitive ? str1.trim() : str1.toLowerCase().trim();
  const s2 = caseSensitive ? str2.trim() : str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - (distance / maxLen));
}
