/**
 * Text Normalizer
 * Normalize Czech construction-related text
 */

export function normalizeText(text) {
  if (!text) {return '';}

  return text
    .toLowerCase()
    .trim()
    // Preserve area/volume units as ASCII (m² -> m2, m³ -> m3) before stripping specials
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    // Remove common Czech stop words
    .replace(/\b(a|v|na|do|z|se|pro|jsou|být|mít)\b/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    // Remove special characters except numbers and Czech letters
    .replace(/[^a-záčďéěíňóřšťúůýž0-9\s/-]/gi, '')
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
