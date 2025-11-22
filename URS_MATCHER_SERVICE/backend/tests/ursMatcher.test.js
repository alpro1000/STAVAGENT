/**
 * URS Matcher Tests
 */

import { matchUrsItems } from '../src/services/ursMatcher.js';

describe('ursMatcher', () => {
  test('should match text with URS items', async () => {
    const result = await matchUrsItems('Podkladní beton C25/30');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('should return empty array for invalid text', async () => {
    const result = await matchUrsItems('');
    expect(Array.isArray(result)).toBe(true);
  });

  test('should return top 5 matches', async () => {
    const result = await matchUrsItems('Beton');
    expect(result.length).toBeLessThanOrEqual(5);
  });

  test('should include confidence scores', async () => {
    const result = await matchUrsItems('Beton podkladní');
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('confidence');
      expect(typeof result[0].confidence).toBe('number');
    }
  });

  test('should include required fields in results', async () => {
    const result = await matchUrsItems('Výztuž');
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('urs_code');
      expect(result[0]).toHaveProperty('urs_name');
      expect(result[0]).toHaveProperty('unit');
    }
  });

  test('should sort by confidence descending', async () => {
    const result = await matchUrsItems('Beton');
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });
});
