/**
 * TZ Text Extractor Tests
 *
 * Tested against real SO-202/203/207 TZ excerpts from golden test data.
 */
import { describe, it, expect } from 'vitest';
import { extractFromText, type ExtractedParam } from './tz-text-extractor';

function findParam(results: ExtractedParam[], name: string): ExtractedParam | undefined {
  return results.find(r => r.name === name);
}

describe('TZ Text Extractor', () => {
  // ─── SO-202 Mostovka (§6.5.1) ──────────────────────────────────────

  describe('SO-202 mostovka excerpt', () => {
    const text = `Nosnou konstrukci levého i pravého mostu tvoří spojitý, monolitický,
dodatečně předpjatý dvoutrám o šesti polích. Šířka NK levého i pravého
mostu je konstantní 10.250 m, délka NK činí 111.500 m, přičemž rozpětí
jednotlivých polí je 15.000 + 4 x 20.000 + 15.000 m. Nosná konstrukce
je navržena z betonu C35/45 XF2.`;

    const results = extractFromText(text);

    it('extracts concrete class C35/45', () => {
      const p = findParam(results, 'concrete_class');
      expect(p).toBeDefined();
      expect(p!.value).toBe('C35/45');
      expect(p!.confidence).toBe(1.0);
    });

    it('extracts exposure class XF2', () => {
      const p = findParam(results, 'exposure_class');
      expect(p).toBeDefined();
      expect(p!.value).toBe('XF2');
    });

    it('extracts span 20m from "15.000 + 4 x 20.000 + 15.000"', () => {
      const p = findParam(results, 'span_m');
      expect(p).toBeDefined();
      expect(p!.value).toBe(20);
    });

    it('extracts 6 spans from "4 x 20 + 2 end spans"', () => {
      const p = findParam(results, 'num_spans');
      expect(p).toBeDefined();
      expect(p!.value).toBe(6);
    });

    it('extracts width 10.25m', () => {
      const p = findParam(results, 'nk_width_m');
      expect(p).toBeDefined();
      expect(p!.value).toBeCloseTo(10.25, 1);
    });

    it('detects element_type mostovkova_deska', () => {
      const p = findParam(results, 'element_type');
      expect(p).toBeDefined();
      expect(p!.value).toBe('mostovkova_deska');
    });

    it('detects is_prestressed', () => {
      const p = findParam(results, 'is_prestressed');
      expect(p).toBeDefined();
      expect(p!.value).toBe(true);
    });

    it('detects bridge_deck_subtype dvoutram', () => {
      const p = findParam(results, 'bridge_deck_subtype');
      expect(p).toBeDefined();
      expect(p!.value).toBe('dvoutram');
    });

    it('extracts 8+ params total', () => {
      expect(results.length).toBeGreaterThanOrEqual(8);
    });
  });

  // ─── SO-202 Předpětí (§6.5.2) ──────────────────────────────────────

  describe('SO-202 prestress excerpt', () => {
    const text = `Nosná konstrukce levého i pravého mostu se dodatečně předepne 12
soudržnými kabely (6ks/trám). Každý kabel bude tvořen 13 lany Y1860S7-15.7.
Napínání kabelů je uvažováno jednostranné.`;

    const results = extractFromText(text);

    it('extracts 12 cables', () => {
      const p = findParam(results, 'prestress_cables_count');
      expect(p).toBeDefined();
      expect(p!.value).toBe(12);
    });

    it('extracts 13 strands per cable', () => {
      const p = findParam(results, 'prestress_strands_per_cable');
      expect(p).toBeDefined();
      expect(p!.value).toBe(13);
    });

    it('detects jednostranné tensioning', () => {
      const p = findParam(results, 'prestress_tensioning');
      expect(p).toBeDefined();
      expect(p!.value).toBe('one_sided');
    });

    it('detects is_prestressed', () => {
      expect(findParam(results, 'is_prestressed')?.value).toBe(true);
    });
  });

  // ─── SO-202 Piloty (§6.3.2) ────────────────────────────────────────

  describe('SO-202 pile excerpt', () => {
    const text = `Opěra OP1 LM: 7.5m Ø900 10ks
Pilíř P2 LM: 11.0m Ø900 8ks
Pilíř P4 LM: 16.0m Ø900 8ks
Všechny piloty jsou navrženy z betonu C30/37 XA2.`;

    const results = extractFromText(text);

    it('extracts concrete C30/37', () => {
      expect(findParam(results, 'concrete_class')?.value).toBe('C30/37');
    });

    it('extracts exposure XA2', () => {
      expect(findParam(results, 'exposure_class')?.value).toBe('XA2');
    });

    it('extracts diameter Ø900', () => {
      expect(findParam(results, 'pile_diameter_mm')?.value).toBe(900);
    });

    it('detects element_type pilota', () => {
      expect(findParam(results, 'element_type')?.value).toBe('pilota');
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('empty text returns empty array', () => {
      expect(extractFromText('')).toEqual([]);
    });

    it('irrelevant text returns empty array', () => {
      expect(extractFromText('Hello world, this is not a TZ')).toEqual([]);
    });

    it('multiple concrete classes: picks highest', () => {
      const r = extractFromText('podkladní beton C12/15, NK z betonu C35/45');
      const p = findParam(r, 'concrete_class');
      expect(p).toBeDefined();
      expect(p!.value).toBe('C35/45');
      expect(p!.confidence).toBe(0.8); // heuristic
    });

    it('thickness extraction: "tl. 250 mm"', () => {
      const r = extractFromText('deska tl. 250 mm');
      expect(findParam(r, 'thickness_mm')?.value).toBe(250);
    });
  });
});
