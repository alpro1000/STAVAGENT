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
 * Fold Czech diacritics to their base ASCII letters (NFD + strip combining marks).
 * Audit M4: real smety are often typed without diacritics ("vykop bourani tr. 3"),
 * so all matching comparisons must be diacritic-insensitive or recall collapses.
 *
 * @param {string} s
 * @returns {string}
 */
export function foldDiacritics(s) {
  if (!s) return '';
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Tokenize a construction description for matching.
 * Folds diacritics, lowercases, and KEEPS discriminative tokens that the old
 * length>2 filters dropped: units (m2/m3/t/ks/bm) and numbers/classes
 * (tř.3 → "3", DN100 → "dn100", C25/30 → "25", "30"). Audit M5.
 *
 * @param {string} s
 * @returns {string[]}
 */
export function tokenize(s) {
  if (!s) return [];
  const folded = foldDiacritics(String(s)).toLowerCase();
  return folded
    .replace(/(\d)[.,](\d)/g, '$1$2')      // 1,5 / 1.5 -> 15 (keep as one token)
    .split(/[^a-z0-9²³]+/)
    .map((t) => t.replace('²', '2').replace('³', '3'))
    .filter(Boolean);
}

/**
 * Token-overlap similarity (0..1): coverage of the shorter token set by the
 * longer one, blended with Jaccard. Unlike whole-string Levenshtein this is NOT
 * length-biased, so a long BOQ line still scores high against a short catalog
 * name when the meaningful tokens overlap. Audit M1.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function tokenOverlapSimilarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;
  const coverage = inter / Math.min(ta.size, tb.size); // how much of the smaller set is covered
  // Weight coverage higher: a catalog name whose every word appears in the BOQ line
  // is a strong match even if the line has extra words.
  return 0.35 * jaccard + 0.65 * coverage;
}

/**
 * Calculate string similarity (0.0 to 1.0).
 * Diacritic-insensitive. Returns the MAX of length-normalized Levenshtein and
 * token-overlap, so it never scores a good match LOWER than the legacy metric
 * (monotonic improvement) while fixing the length-bias for description↔catalog.
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {boolean} [caseSensitive=false] - Whether comparison is case-sensitive
 * @returns {number} Similarity score between 0.0 and 1.0
 */
export function calculateSimilarity(str1, str2, caseSensitive = false) {
  const raw1 = caseSensitive ? str1.trim() : str1.toLowerCase().trim();
  const raw2 = caseSensitive ? str2.trim() : str2.toLowerCase().trim();
  // Diacritic-insensitive base strings for the edit-distance component.
  const s1 = foldDiacritics(raw1);
  const s2 = foldDiacritics(raw2);

  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  const levSim = Math.max(0, 1.0 - (distance / maxLen));
  const tokenSim = tokenOverlapSimilarity(raw1, raw2);
  return Math.max(levSim, tokenSim);
}
