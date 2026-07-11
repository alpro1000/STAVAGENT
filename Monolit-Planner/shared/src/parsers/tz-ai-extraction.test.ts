/**
 * AI layer of the TZ smart input — hermetic tests of the pure core.
 *
 * The ladder contract (Determinism > AI):
 *   - manifest = only fields APPLICABLE to the element type, with
 *     element-specific labels + sanity ranges;
 *   - mergeAiParams NEVER lets AI overwrite a deterministic hit, requires a
 *     verbatim quote, validates type + sanity range BEFORE anything is shown,
 *     and caps confidence at 0.70 (repo ladder).
 */
import { describe, it, expect } from 'vitest';
import {
  AI_CONFIDENCE_CAP,
  buildAiExtractionPrompt,
  buildExtractionManifest,
  mergeAiParams,
} from './tz-ai-extraction.js';
import type { ExtractedParam } from './tz-text-extractor.js';

const det = (name: string, value: ExtractedParam['value']): ExtractedParam => ({
  name, value, label_cs: name, confidence: 1.0, source: 'regex', matched_text: 'x',
});

describe('buildExtractionManifest', () => {
  it('mostovka includes bridge params with element-specific labels + ranges', () => {
    const m = buildExtractionManifest('mostovkova_deska');
    const fields = m.map(f => f.field);
    expect(fields).toContain('span_m');
    expect(fields).toContain('num_spans');
    expect(fields).toContain('nk_width_m');
    expect(fields).toContain('is_prestressed');
    expect(fields).not.toContain('pile_diameter_mm');   // pile-only
    const height = m.find(f => f.field === 'height_m')!;
    expect(height.label_cs).toBe('Výška nad terénem');  // REQUIRED_FIELDS wording
    const vol = m.find(f => f.field === 'volume_m3')!;
    expect(vol.range).toBeDefined();                     // SANITY_RANGES attached
  });

  it('stena excludes bridge-deck params; pilota includes its diameter', () => {
    const stena = buildExtractionManifest('stena').map(f => f.field);
    expect(stena).not.toContain('span_m');
    expect(stena).not.toContain('pile_diameter_mm');
    const pilota = buildExtractionManifest('pilota').map(f => f.field);
    expect(pilota).toContain('pile_diameter_mm');
  });

  it('never offers element_type (AI must not switch the element)', () => {
    for (const t of ['mostovkova_deska', 'stena', 'pilota'] as const) {
      expect(buildExtractionManifest(t).map(f => f.field)).not.toContain('element_type');
    }
  });
});

describe('buildAiExtractionPrompt', () => {
  it('carries the manifest, the no-fabrication + quote rules, and the text', () => {
    const p = buildAiExtractionPrompt('mostovkova_deska', 'Nosná konstrukce o třech polích.');
    expect(p).toContain('span_m');
    expect(p).toContain('NIKDY nefabrikuj');
    expect(p).toContain('quote');
    expect(p).toContain('Nosná konstrukce o třech polích.');
  });

  it('truncates very long TZ text', () => {
    const p = buildAiExtractionPrompt('stena', 'x'.repeat(10_000));
    expect(p.length).toBeLessThan(9_000);
  });
});

describe('mergeAiParams — the guard', () => {
  it('accepts a quoted, in-range gap fill at capped confidence', () => {
    const { accepted, rejected } = mergeAiParams(
      [det('concrete_class', 'C35/45')],
      [{ field: 'height_m', value: 14.9, quote: 'výška nad terénem 14,9 m', confidence: 0.95 }],
      'mostovkova_deska',
    );
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      name: 'height_m', value: 14.9, source: 'ai',
      confidence: AI_CONFIDENCE_CAP,                    // 0.95 capped to 0.70
      matched_text: 'výška nad terénem 14,9 m',
    });
  });

  it('NEVER overwrites a deterministic hit', () => {
    const { accepted, rejected } = mergeAiParams(
      [det('height_m', 12)],
      [{ field: 'height_m', value: 14.9, quote: 'q' }],
      'mostovkova_deska',
    );
    expect(accepted).toEqual([]);
    expect(rejected[0].reason_cs).toContain('nikdy nepřepisuje');
  });

  it('rejects: missing quote / out-of-manifest field / out-of-range value', () => {
    const { accepted, rejected } = mergeAiParams(
      [],
      [
        { field: 'height_m', value: 14.9 },                              // no quote
        { field: 'pile_diameter_mm', value: 900, quote: 'q' },           // not for mostovka
        { field: 'volume_m3', value: 999999, quote: 'q' },               // out of range
      ],
      'mostovkova_deska',
    );
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(3);
    expect(rejected[0].reason_cs).toContain('citace');
    expect(rejected[1].reason_cs).toContain('manifestu');
    expect(rejected[2].reason_cs).toContain('rozsah');
  });

  it('coerces types: czech decimal comma, exposure string → UPPER array, bool', () => {
    const { accepted } = mergeAiParams(
      [],
      [
        { field: 'span_m', value: '44,5', quote: 'q' },
        { field: 'exposure_classes', value: 'xf2+xd1, xc4', quote: 'q' },
        { field: 'is_prestressed', value: 'ano', quote: 'q' },
      ],
      'mostovkova_deska',
    );
    const byName = Object.fromEntries(accepted.map(a => [a.name, a.value]));
    expect(byName['span_m']).toBe(44.5);
    expect(byName['exposure_classes']).toEqual(['XF2', 'XD1', 'XC4']);
    expect(byName['is_prestressed']).toBe(true);
  });

  it('non-array payload and duplicate fields are rejected honestly', () => {
    expect(mergeAiParams([], { not: 'array' }, 'stena').rejected[0].reason_cs).toContain('formát');
    const dup = mergeAiParams(
      [],
      [
        { field: 'height_m', value: 3, quote: 'q1' },
        { field: 'height_m', value: 4, quote: 'q2' },
      ],
      'stena',
    );
    expect(dup.accepted).toHaveLength(1);
    expect(dup.accepted[0].value).toBe(3);              // first wins
    expect(dup.rejected[0].reason_cs).toContain('Duplicitní');
  });
});
