/**
 * TZ AI extraction — robust JSON-array extraction from LLM answers.
 *
 * Gemini via Multi-Role has no force-JSON yet (known Core TODO): the answer
 * may be a bare array, a ```json fence, or prose-wrapped. A non-parseable
 * answer must yield null (typed error upstream), never a fabricated list.
 */
import { describe, test, expect } from '@jest/globals';
import { extractJsonArray } from '../../src/routes/tz-ai-extract.js';

describe('extractJsonArray', () => {
  const arr = [{ field: 'height_m', value: 14.9, quote: 'výška 14,9 m' }];

  test('bare JSON array', () => {
    expect(extractJsonArray(JSON.stringify(arr))).toEqual(arr);
  });

  test('```json fenced array', () => {
    const text = 'Zde jsou parametry:\n```json\n' + JSON.stringify(arr) + '\n```\nHotovo.';
    expect(extractJsonArray(text)).toEqual(arr);
  });

  test('prose-wrapped array without fence', () => {
    const text = 'Nalezl jsem tato pole: ' + JSON.stringify(arr) + ' — vše s citacemi.';
    expect(extractJsonArray(text)).toEqual(arr);
  });

  test('no array → null (never fabricate)', () => {
    expect(extractJsonArray('Bohužel jsem nic nenašel.')).toBeNull();
    expect(extractJsonArray('')).toBeNull();
    expect(extractJsonArray(null)).toBeNull();
  });

  test('JSON object (not array) → null', () => {
    expect(extractJsonArray('{"field": "height_m"}')).toBeNull();
  });

  test('broken JSON inside brackets → null, no throw', () => {
    expect(extractJsonArray('[{"field": "height_m", value: broken]')).toBeNull();
  });
});
