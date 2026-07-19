/**
 * Hermetic tests for extractJson (audit M7) — balanced-brace JSON extraction that
 * replaces the greedy /\{[\s\S]*\}/ which broke on Perplexity prose + citations.
 * Pure function — no DB, no network.
 */
import { extractJson } from '../src/utils/jsonExtract.js';

describe('extractJson', () => {
  test('extracts object from Perplexity prose with [n] citations (the regression that broke search)', () => {
    const s = 'Podle podminky.urs.cz [1] jsem našel: {"candidates":[{"code":"274313811","name":"Beton"}]}. Zdroj [2].';
    expect(extractJson(s)).toEqual({ candidates: [{ code: '274313811', name: 'Beton' }] });
    // and prove the old greedy regex would have thrown on this input
    expect(() => JSON.parse(s.match(/\{[\s\S]*\}/)[0])).toThrow();
  });

  test('handles ```json fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test('respects braces inside string literals and nesting', () => {
    expect(extractJson('x {"s":"a{b}c","n":{"m":2}} y')).toEqual({ s: 'a{b}c', n: { m: 2 } });
  });

  test('prefers the outermost/longest payload over a leading citation array', () => {
    expect(extractJson('[1] then {"selected_code":"X"}')).toEqual({ selected_code: 'X' });
  });

  test('still returns a genuine top-level array payload', () => {
    expect(extractJson('result: [{"code":"A"}]')).toEqual([{ code: 'A' }]);
  });

  test('skips a balanced-but-invalid span and finds the valid one', () => {
    expect(extractJson('{bad json} {"ok":true}')).toEqual({ ok: true });
  });

  test('returns null when there is no JSON', () => {
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('')).toBeNull();
    expect(extractJson(null)).toBeNull();
  });
});
