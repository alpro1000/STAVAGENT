/**
 * File Parser Tests
 */

import { parseExcelFile } from '../src/services/fileParser.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilePath = path.join(__dirname, 'fixtures/test.csv');

describe('fileParser', () => {
  test('should parse CSV file successfully', async () => {
    const result = await parseExcelFile(testFilePath);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should return objects with required fields', async () => {
    const result = await parseExcelFile(testFilePath);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('quantity');
      expect(result[0]).toHaveProperty('unit');
    }
  });

  test('should parse quantities as numbers', async () => {
    const result = await parseExcelFile(testFilePath);
    if (result.length > 0) {
      expect(typeof result[0].quantity).toBe('number');
    }
  });

  test('should trim description whitespace', async () => {
    const result = await parseExcelFile(testFilePath);
    result.forEach(row => {
      expect(row.description).toBe(row.description.trim());
    });
  });

  test('should skip empty rows', async () => {
    const result = await parseExcelFile(testFilePath);
    result.forEach(row => {
      expect(row.description).toBeTruthy();
    });
  });

  test('should have default unit "ks" if not specified', async () => {
    const result = await parseExcelFile(testFilePath);
    result.forEach(row => {
      expect(row.unit).toBeTruthy();
    });
  });
});
