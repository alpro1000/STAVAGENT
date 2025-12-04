/**
 * Text Normalizer
 * Normalize Czech construction-related text
 */

export function normalizeText(text) {
  if (!text) {return '';}

  return text
    .toLowerCase()
    .trim()
    // Remove common Czech stop words
    .replace(/\b(a|v|na|do|z|se|se|pro|jsou|být|mít)\b/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    // Remove special characters except numbers and Czech letters
    .replace(/[^a-záčďéěíňóřšťúůýž0-9\s/-]/gi, '')
    // Remove numbers (keep structural dimensions like C25/30)
    .replace(/\b\d+(?!\/)\b/g, '')
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
