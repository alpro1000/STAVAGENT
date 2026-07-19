/**
 * Hermetic tests for the diacritic-insensitive, token-overlap similarity utilities
 * (audit fixes M1/M4/M5). Pure functions — no DB, no network.
 */
import {
  calculateSimilarity,
  tokenOverlapSimilarity,
  foldDiacritics,
  tokenize,
  levenshteinDistance,
} from '../src/utils/similarity.js';

describe('foldDiacritics', () => {
  test('strips Czech diacritics to ASCII base', () => {
    expect(foldDiacritics('Hloubení nezapažených rýh tř.3')).toBe('Hloubeni nezapazenych ryh tr.3');
  });
  test('empty/null safe', () => {
    expect(foldDiacritics('')).toBe('');
    expect(foldDiacritics(null)).toBe('');
  });
});

describe('tokenize', () => {
  test('keeps discriminative numbers and units (M5)', () => {
    expect(tokenize('Beton C25/30 tl. 100 mm m²')).toEqual(
      expect.arrayContaining(['beton', 'c25', '30', 'tl', '100', 'mm', 'm2'])
    );
  });
});

describe('calculateSimilarity', () => {
  test('identical (case/diacritic-insensitive) = 1.0', () => {
    expect(calculateSimilarity('Beton', 'beton')).toBe(1.0);
    expect(calculateSimilarity('Výkop', 'vykop')).toBe(1.0);
  });

  test('diacritic-insensitive recall (M4): typed-without-diacritics matches catalog', () => {
    expect(calculateSimilarity('vykop bourani tr 3', 'Výkop bourání tř. 3')).toBeGreaterThan(0.85);
  });

  test('not length-biased (M1): long BOQ line still scores its short catalog match higher than an unrelated one', () => {
    const line = 'Podkladní beton C25/30 tl. 100 mm pod základové pasy';
    const good = 'Podkladní beton C25/30';
    const bad = 'Montáž zábradlí hliníkového';
    expect(calculateSimilarity(line, good)).toBeGreaterThan(calculateSimilarity(line, bad));
  });

  test('never lower than the legacy length-normalized Levenshtein (monotonic)', () => {
    const a = 'Podkladní beton C25/30 tl. 100 mm pod základové pasy';
    const b = 'Podkladní beton C25/30';
    const s1 = foldDiacritics(a.toLowerCase());
    const s2 = foldDiacritics(b.toLowerCase());
    const legacyLev = Math.max(0, 1 - levenshteinDistance(s1, s2) / Math.max(s1.length, s2.length));
    expect(calculateSimilarity(a, b)).toBeGreaterThanOrEqual(legacyLev - 1e-9);
  });

  test('unrelated stays low', () => {
    expect(calculateSimilarity('Montáž zábradlí hliník', 'Odvoz suti na skládku')).toBeLessThan(0.4);
  });
});

describe('tokenOverlapSimilarity', () => {
  test('full coverage of the shorter token set scores high', () => {
    expect(tokenOverlapSimilarity('beton c25 30 deska', 'beton c25 30')).toBeGreaterThan(0.7);
  });
  test('empty inputs = 0', () => {
    expect(tokenOverlapSimilarity('', 'beton')).toBe(0);
  });
});
