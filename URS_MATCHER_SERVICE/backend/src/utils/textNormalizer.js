/**
 * Text Normalizer
 * Normalize Czech construction-related text.
 *
 * SINGLE normalization source for the matching door (Etapa 1, SPEC §3):
 * diacritics are FOLDED here, symmetrically — the same function runs on the
 * query, on the scored item name, and (via importers) on the stored
 * search_name column, so an unaccented query finds an accented item and vice
 * versa BY CONSTRUCTION. Live evidence for why: corpus nodiacritics lines
 * returned 0 candidates (5/5) because the SQL door compared raw accented
 * names against unfolded query words (SQLite LOWER() is ASCII-only).
 * Numbers, classes, diameters and thicknesses are NEVER stripped (audit M5).
 */

/** Strip Czech diacritics (á→a, ř→r, …). Numbers and ASCII untouched. */
export function foldDiacritics(text) {
  if (!text) {return '';}
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeText(text) {
  if (!text) {return '';}

  return foldDiacritics(text)
    .toLowerCase()
    .trim()
    // Preserve area/volume units as ASCII (m² -> m2, m³ -> m3) before stripping specials
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    // Remove common Czech stop words (folded forms — the text is already folded)
    .replace(/\b(a|v|na|do|z|se|pro|jsou|byt|mit)\b/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    // Remove special characters except numbers and letters (text is folded to ASCII)
    .replace(/[^a-z0-9\s/-]/gi, '')
    // Audit M5: KEEP numbers — dimensions and classes (tř. 3, DN 100, tl. 100 mm,
    // C25/30) are highly discriminative for ÚRS matching and must not be stripped.
    .trim();
}

export function extractConcreteGrade(text) {
  const match = text.match(/C\s*\d{2}\/\d{2}/i);
  return match ? match[0].replace(/\s/g, '') : null;
}

export function extractDimensions(text) {
  const matches = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m|km|tl|mm2|cm2|m2|m3)/gi);
  return matches || [];
}
