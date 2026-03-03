/**
 * Relink Service Unit Tests
 * Tests for 4-step relink algorithm
 */

import { describe, test, expect } from '@jest/globals';
import {
  primaryMatch,
  fallbackMatch,
  fuzzyMatch
} from '../src/services/relinkService.js';

describe('Relink Service', () => {
  describe('primaryMatch', () => {
    test('exact match - all fields match', async () => {
      const oldPositions = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const newPositions = [{
        id: 2,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu',
        quantity: 105,
        kiosk_data: { catalog_code: '272324' }
      }];

      const result = await primaryMatch(oldPositions, newPositions);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].confidence).toBe('GREEN');
      expect(result.matches[0].match_type).toBe('primary');
      expect(result.matches[0].qty_change).toBe(5); // (105-100)/100 = 5%
      expect(result.unmatchedOld).toHaveLength(0);
      expect(result.unmatchedNew).toHaveLength(0);
    });

    test('no match - different catalog_code', async () => {
      const oldPositions = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const newPositions = [{
        id: 2,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu',
        quantity: 100,
        kiosk_data: { catalog_code: '999999' }
      }];

      const result = await primaryMatch(oldPositions, newPositions);

      expect(result.matches).toHaveLength(0);
      expect(result.unmatchedOld).toHaveLength(1);
      expect(result.unmatchedNew).toHaveLength(1);
    });

    test('multiple positions - matches first', async () => {
      const oldPositions = [
        {
          id: 1,
          position_code: '1.1',
          position_name: 'Beton C30/37',
          quantity: 50,
          kiosk_data: { catalog_code: '272324' }
        },
        {
          id: 2,
          position_code: '1.2',
          position_name: 'Výztuž B500B',
          quantity: 5,
          kiosk_data: { catalog_code: '273111' }
        }
      ];

      const newPositions = [
        {
          id: 3,
          position_code: '1.1',
          position_name: 'Beton C30/37',
          quantity: 55,
          kiosk_data: { catalog_code: '272324' }
        },
        {
          id: 4,
          position_code: '1.2',
          position_name: 'Výztuž B500B',
          quantity: 5.5,
          kiosk_data: { catalog_code: '273111' }
        }
      ];

      const result = await primaryMatch(oldPositions, newPositions);

      expect(result.matches).toHaveLength(2);
      expect(result.unmatchedOld).toHaveLength(0);
      expect(result.unmatchedNew).toHaveLength(0);
    });
  });

  describe('fallbackMatch', () => {
    test('row shift +2 - within tolerance', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy',
        quantity: 100,
        kiosk_data: { row_index: 10, catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4', // Different code
        position_name: 'Základy',
        quantity: 100,
        kiosk_data: { row_index: 12, catalog_code: '272324' }
      }];

      const result = await fallbackMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].confidence).toBe('AMBER');
      expect(result.matches[0].match_type).toBe('fallback');
      expect(result.matches[0].row_shift).toBe(2);
    });

    test('row shift -2 - within tolerance', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy',
        quantity: 100,
        kiosk_data: { row_index: 12, catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4',
        position_name: 'Základy',
        quantity: 100,
        kiosk_data: { row_index: 10, catalog_code: '272324' }
      }];

      const result = await fallbackMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].row_shift).toBe(-2);
    });

    test('row shift >2 - no match', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy',
        quantity: 100,
        kiosk_data: { row_index: 10, catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4',
        position_name: 'Základy',
        quantity: 100,
        kiosk_data: { row_index: 15, catalog_code: '272324' }
      }];

      const result = await fallbackMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(0);
      expect(result.unmatchedOld).toHaveLength(1);
      expect(result.unmatchedNew).toHaveLength(1);
    });
  });

  describe('fuzzyMatch', () => {
    test('high similarity (>0.9) - AMBER confidence', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu C30/37',
        description_normalized: 'zaklady ze zelezobetonu c30/37',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4',
        position_name: 'Základy z železobetonu C30/37',
        description_normalized: 'zaklady z zelezobetonu c30/37',
        quantity: 105,
        kiosk_data: { catalog_code: '272324' }
      }];

      const result = await fuzzyMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].confidence).toBe('AMBER');
      expect(result.matches[0].match_type).toBe('fuzzy');
      expect(result.matches[0].similarity_score).toBeGreaterThan(0.9);
    });

    test('medium similarity (0.75-0.9) - RED confidence', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu',
        description_normalized: 'zaklady ze zelezobetonu',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4',
        position_name: 'Základy z betonu',
        description_normalized: 'zaklady z betonu',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const result = await fuzzyMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].confidence).toBe('RED');
      expect(result.matches[0].similarity_score).toBeGreaterThan(0.75);
      expect(result.matches[0].similarity_score).toBeLessThan(0.9);
    });

    test('low similarity (<0.75) - no match', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu',
        description_normalized: 'zaklady ze zelezobetonu',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4',
        position_name: 'Výztuž B500B',
        description_normalized: 'vystuz b500b',
        quantity: 5,
        kiosk_data: { catalog_code: '272324' }
      }];

      const result = await fuzzyMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(0);
      expect(result.orphaned).toHaveLength(1);
      expect(result.newPositions).toHaveLength(1);
    });

    test('qty change >20% - no match', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy ze železobetonu',
        description_normalized: 'zaklady ze zelezobetonu',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4',
        position_name: 'Základy ze železobetonu',
        description_normalized: 'zaklady ze zelezobetonu',
        quantity: 150, // 50% increase
        kiosk_data: { catalog_code: '272324' }
      }];

      const result = await fuzzyMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(0);
      expect(result.orphaned).toHaveLength(1);
    });

    test('different catalog_code - orphaned', async () => {
      const unmatchedOld = [{
        id: 1,
        position_code: '1.2.3',
        position_name: 'Základy',
        description_normalized: 'zaklady',
        quantity: 100,
        kiosk_data: { catalog_code: '272324' }
      }];

      const unmatchedNew = [{
        id: 2,
        position_code: '1.2.4',
        position_name: 'Základy',
        description_normalized: 'zaklady',
        quantity: 100,
        kiosk_data: { catalog_code: '999999' }
      }];

      const result = await fuzzyMatch(unmatchedOld, unmatchedNew);

      expect(result.matches).toHaveLength(0);
      expect(result.orphaned).toHaveLength(1);
      expect(result.newPositions).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    test('empty old positions', async () => {
      const result = await primaryMatch([], [{ id: 1, position_code: '1.1', position_name: 'Test', quantity: 1, kiosk_data: {} }]);
      expect(result.matches).toHaveLength(0);
      expect(result.unmatchedNew).toHaveLength(1);
    });

    test('empty new positions', async () => {
      const result = await primaryMatch([{ id: 1, position_code: '1.1', position_name: 'Test', quantity: 1, kiosk_data: {} }], []);
      expect(result.matches).toHaveLength(0);
      expect(result.unmatchedOld).toHaveLength(1);
    });

    test('missing kiosk_data', async () => {
      const oldPositions = [{ id: 1, position_code: '1.1', position_name: 'Test', quantity: 1 }];
      const newPositions = [{ id: 2, position_code: '1.1', position_name: 'Test', quantity: 1 }];
      
      const result = await primaryMatch(oldPositions, newPositions);
      expect(result.matches).toHaveLength(0);
    });
  });
});
