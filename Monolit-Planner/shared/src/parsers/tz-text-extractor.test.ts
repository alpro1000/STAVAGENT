/**
 * TZ Text Extractor Tests
 *
 * Tested against real SO-202/203/207 TZ excerpts from golden test data.
 */
import { describe, it, expect } from 'vitest';
import {
  extractFromText,
  extractSmetaLines,
  parseCzechNumber,
  type ExtractedParam,
} from './tz-text-extractor';

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

  // ─── Czech number parsing ───────────────────────────────────────────────

  describe('parseCzechNumber', () => {
    it('94,231 → 94.231 (Czech decimal, 3 places)', () => {
      expect(parseCzechNumber('94,231')).toBeCloseTo(94.231, 3);
    });

    it('547,400 → 547.4 (trailing zero decimals)', () => {
      expect(parseCzechNumber('547,400')).toBeCloseTo(547.4, 3);
    });

    it('5,654 → 5.654 (short Czech decimal)', () => {
      expect(parseCzechNumber('5,654')).toBeCloseTo(5.654, 3);
    });

    it('"1 456,78" → 1456.78 (space thousands + comma decimal)', () => {
      expect(parseCzechNumber('1 456,78')).toBeCloseTo(1456.78, 2);
    });

    it('"1.456,78" → 1456.78 (EU: period thousands, comma decimal)', () => {
      expect(parseCzechNumber('1.456,78')).toBeCloseTo(1456.78, 2);
    });

    it('"1,456.78" → 1456.78 (US: comma thousands, period decimal)', () => {
      expect(parseCzechNumber('1,456.78')).toBeCloseTo(1456.78, 2);
    });

    it('"1,234,567" → 1234567 (multiple commas → thousands)', () => {
      expect(parseCzechNumber('1,234,567')).toBe(1234567);
    });

    it('integer "94" → 94', () => {
      expect(parseCzechNumber('94')).toBe(94);
    });
  });

  // ─── Smeta line extraction ──────────────────────────────────────────────

  describe('extractSmetaLines (VP4 opěrná zeď — live bug 2026-04-17)', () => {
    // Real smeta excerpt from the live user feedback — 3 positions under
    // one opěrná zeď VP4. Before this extractor, UI surfaced only 3 params
    // (concrete/exposure/volume from free-text regex) and missed 547,4 m²
    // formwork area + 5,654 t rebar despite both being right there.
    const VP4_SMETA = `
327323127  Opěrné zdi a valy ze ŽB tř. C 25/30                m3  94,231   "VP4" (0,8*0,3+1,45*0,25)*156,4
327351211  Bednění opěrných zdí a valů svislých i skloněných  m2  547,400  "VP4" 1,75*2*156,4
327361006  Výztuž opěrných zdí a valů D 12 mm z bet. oceli    t   5,654    94,231*0,06
`;

    const lines = extractSmetaLines(VP4_SMETA);

    it('parses 3 smeta lines', () => {
      expect(lines).toHaveLength(3);
    });

    it('line 1: code=327323127, catalog=urs, work_type=beton, unit=m3, qty=94.231', () => {
      expect(lines[0].code).toBe('327323127');
      expect(lines[0].catalog).toBe('urs');
      expect(lines[0].work_type).toBe('beton');
      expect(lines[0].unit).toBe('m3');
      expect(lines[0].quantity).toBeCloseTo(94.231, 3);
    });

    it('line 2: code=327351211 → bednění + m2 + 547.4', () => {
      expect(lines[1].code).toBe('327351211');
      expect(lines[1].work_type === 'bednění' || lines[1].work_type === 'bednění_zřízení')
        .toBe(true);
      expect(lines[1].unit).toBe('m2');
      expect(lines[1].quantity).toBeCloseTo(547.4, 1);
    });

    it('line 3: code=327361006 → výztuž + t + 5.654', () => {
      expect(lines[2].code).toBe('327361006');
      expect(lines[2].work_type).toBe('výztuž');
      expect(lines[2].unit).toBe('t');
      expect(lines[2].quantity).toBeCloseTo(5.654, 3);
    });

    it('preserves description text (strips leading/trailing whitespace)', () => {
      expect(lines[0].description).toContain('Opěrné zdi');
      expect(lines[0].description).toContain('C 25/30');
    });
  });

  describe('extractSmetaLines — edge cases', () => {
    it('empty text returns []', () => {
      expect(extractSmetaLines('')).toEqual([]);
    });

    it('non-smeta text returns []', () => {
      expect(extractSmetaLines('Nosná konstrukce je C35/45, rozpětí 20 m.')).toEqual([]);
    });

    it('4-digit code is skipped (not OTSKP/URS format)', () => {
      expect(extractSmetaLines('1234 Nějaký popis m3 10,0')).toEqual([]);
    });

    it('OTSKP 6-digit code → catalog=otskp', () => {
      const r = extractSmetaLines('113472  Odstranění krytu  m3  50,0');
      expect(r).toHaveLength(1);
      expect(r[0].catalog).toBe('otskp');
    });

    it('normalizes Unicode unit m² → m2', () => {
      const r = extractSmetaLines('327351211  Bednění stěn  m²  100,0');
      expect(r).toHaveLength(1);
      expect(r[0].unit).toBe('m2');
    });

    it('normalizes Unicode unit m³ → m3', () => {
      const r = extractSmetaLines('327323127  Beton stěn  m³  50,0');
      expect(r).toHaveLength(1);
      expect(r[0].unit).toBe('m3');
    });

    it('handles multiple spaces / tabs between columns', () => {
      const r = extractSmetaLines('327323127\t\tBeton\t\tm3\t\t94,231');
      expect(r).toHaveLength(1);
      expect(r[0].quantity).toBeCloseTo(94.231, 3);
    });
  });

  // ─── extractFromText — smeta integration ────────────────────────────────

  describe('extractFromText — VP4 opěrná zeď full round-trip', () => {
    const VP4_TEXT = `Opěrné zdi VP4 — beton C25/30, XC4, XF1, XA1, výztuž B500B (10 505 (R)), 150 kg/m3.

327323127  Opěrné zdi a valy ze ŽB tř. C 25/30                m3  94,231   "VP4" (0,8*0,3+1,45*0,25)*156,4
327351211  Bednění opěrných zdí a valů svislých i skloněných  m2  547,400  "VP4" 1,75*2*156,4
327361006  Výztuž opěrných zdí a valů D 12 mm z bet. oceli    t   5,654    94,231*0,06
`;

    const results = extractFromText(VP4_TEXT, { element_type: 'operne_zdi' });

    it('volume_m3 = 94.231 from smeta (not free-text regex)', () => {
      const p = findParam(results, 'volume_m3');
      expect(p).toBeDefined();
      expect(p!.value).toBeCloseTo(94.231, 3);
      expect(p!.source).toBe('smeta_line');
      expect(p!.confidence).toBe(1.0);
      expect(p!.catalog).toBe('urs');
      expect(p!.code).toBe('327323127');
    });

    it('formwork_area_m2 = 547.4 from smeta (NEW — was missing before)', () => {
      const p = findParam(results, 'formwork_area_m2');
      expect(p).toBeDefined();
      expect(p!.value).toBeCloseTo(547.4, 1);
      expect(p!.source).toBe('smeta_line');
      expect(p!.code).toBe('327351211');
    });

    it('reinforcement_total_kg = 5654 kg (converted from 5.654 t)', () => {
      const p = findParam(results, 'reinforcement_total_kg');
      expect(p).toBeDefined();
      expect(p!.value as number).toBeCloseTo(5654, 0);
      expect(p!.source).toBe('smeta_line');
      expect(p!.code).toBe('327361006');
    });

    it('concrete_class C25/30 still detected from free-text', () => {
      expect(findParam(results, 'concrete_class')?.value).toBe('C25/30');
    });

    it('exposure_class highest-priority from {XC4, XF1, XA1} = XF1', () => {
      // XF has priority 4 (highest) vs XA(2)/XC(1) in existing heuristic
      expect(findParam(results, 'exposure_class')?.value).toBe('XF1');
    });

    it('≥5 params extracted (vs only 3 before the fix)', () => {
      expect(results.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ─── Codeless smeta rows (live bug 2026-04-20) ──────────────────────────

  describe('extractSmetaLines — codeless (no OTSKP/URS code prefix)', () => {
    // Exact text pasted by the user on 2026-04-20 — same VP4 opěrná zeď as
    // the 2026-04-17 case, but the OTSKP codes were stripped during copy.
    // Extractor had to classify each line purely from description + unit.
    const VP4_CODELESS = `- základní popis viz B – Souhrnná technická zpráva oddíl B 3.1.4.
- průřez opěrné stěny je znázorněn na samostatném výkresu VP3 – Přístřešek II – schéma
- železobetonová monolitická opěrná stěna – podrobně řešeno v DPS
- beton C25/30, XC4, XF1, XA1, výztuž B500B (10 505 (R)), 150 kg/m3

Opěrné zdi a valy ze ŽB tř. C 25/30 94,231 m3 'VP4' (0,8*0,3+1,45*0,25)*156,4
Bednění opěrných zdí a valů svislých i skloněných zřízení 547,400 m2 'VP4' 1,75*2*156,4
Výztuž opěrných zdí a valů D 12 mm z betonářské oceli 10 505 - 5,654 t
`;

    const lines = extractSmetaLines(VP4_CODELESS);

    it('extracts all 3 codeless smeta rows', () => {
      expect(lines).toHaveLength(3);
    });

    it('line 1 "Opěrné zdi … ze ŽB … 94,231 m3" → beton + m3 + 94.231', () => {
      expect(lines[0].code).toBe('');
      expect(lines[0].catalog).toBe('unknown');
      expect(lines[0].work_type).toBe('beton');
      expect(lines[0].unit).toBe('m3');
      expect(lines[0].quantity).toBeCloseTo(94.231, 3);
    });

    it('line 2 "Bednění … zřízení 547,400 m2" → bednění_zřízení + m2 + 547.4', () => {
      expect(lines[1].work_type).toBe('bednění_zřízení');
      expect(lines[1].unit).toBe('m2');
      expect(lines[1].quantity).toBeCloseTo(547.4, 1);
    });

    it('line 3 "Výztuž … - 5,654 t" → výztuž + t + 5.654', () => {
      expect(lines[2].work_type).toBe('výztuž');
      expect(lines[2].unit).toBe('t');
      expect(lines[2].quantity).toBeCloseTo(5.654, 3);
    });

    it('prose lines (no qty+unit or no work-type keyword) rejected', () => {
      // "- železobetonová monolitická opěrná stěna …" has no quantity — reject.
      // "150 kg/m3" line has "kg/m3" which is caught by rebar-ratio regex,
      // not codeless smeta (no standalone work-type classification).
      // Only the 3 real smeta rows should be returned.
      expect(lines.every(l => /^(Opěrné|Bednění|Výztuž)/.test(l.description)))
        .toBe(true);
    });
  });

  describe('extractFromText — VP4 codeless live bug (2026-04-20)', () => {
    const VP4_CODELESS = `- základní popis viz B – Souhrnná technická zpráva oddíl B 3.1.4.
- železobetonová monolitická opěrná stěna – podrobně řešeno v DPS
- beton C25/30, XC4, XF1, XA1, výztuž B500B (10 505 (R)), 150 kg/m3

Opěrné zdi a valy ze ŽB tř. C 25/30 94,231 m3 'VP4' (0,8*0,3+1,45*0,25)*156,4
Bednění opěrných zdí a valů svislých i skloněných zřízení 547,400 m2 'VP4' 1,75*2*156,4
Výztuž opěrných zdí a valů D 12 mm z betonářské oceli 10 505 - 5,654 t
`;

    const results = extractFromText(VP4_CODELESS, { element_type: 'operne_zdi' });

    it('volume_m3 = 94.231 from codeless smeta', () => {
      const p = findParam(results, 'volume_m3');
      expect(p).toBeDefined();
      expect(p!.value).toBeCloseTo(94.231, 3);
      expect(p!.source).toBe('smeta_line');
      expect(p!.catalog).toBe('unknown'); // codeless → no catalog
    });

    it('formwork_area_m2 = 547.4 from codeless smeta', () => {
      const p = findParam(results, 'formwork_area_m2');
      expect(p).toBeDefined();
      expect(p!.value).toBeCloseTo(547.4, 1);
      expect(p!.source).toBe('smeta_line');
    });

    it('reinforcement_total_kg = 5654 kg from codeless smeta', () => {
      const p = findParam(results, 'reinforcement_total_kg');
      expect(p).toBeDefined();
      expect(p!.value as number).toBeCloseTo(5654, 0);
    });

    it('reinforcement_ratio_kg_m3 = 150 from "150 kg/m3" free text', () => {
      const p = findParam(results, 'reinforcement_ratio_kg_m3');
      expect(p).toBeDefined();
      expect(p!.value).toBe(150);
      expect(p!.source).toBe('regex');
    });

    it('element_type = operne_zdi from "opěrná stěna" keyword', () => {
      const p = findParam(results, 'element_type');
      expect(p).toBeDefined();
      expect(p!.value).toBe('operne_zdi');
    });

    it('concrete_class C25/30 detected', () => {
      expect(findParam(results, 'concrete_class')?.value).toBe('C25/30');
    });

    it('≥6 params extracted (vs only 3 before the codeless fix)', () => {
      expect(results.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('codeless regex — false-positive guards', () => {
    it('prose "výška 1,75 m" does NOT match (no work-type keyword)', () => {
      const r = extractSmetaLines('výška stěny je 1,75 m nad terénem');
      expect(r).toEqual([]);
    });

    it('prose "200 kg/m3 cement" does NOT match as smeta line', () => {
      // Line has no work-type keyword ('beton'/'bednění'/etc.). Also "kg/m3"
      // has "/" after "kg" so the unit lookahead fails anyway.
      const r = extractSmetaLines('dávka cementu 200 kg/m3');
      expect(r).toEqual([]);
    });

    it('"D 12 mm" does NOT trigger as "12 m" (mm not a valid unit)', () => {
      const r = extractSmetaLines('Výztuž D 12 mm z oceli');
      // No quantity+unit pair satisfies the regex → no smeta row extracted
      expect(r).toEqual([]);
    });
  });

  describe('rebar ratio extraction', () => {
    it('extracts "150 kg/m3" → 150', () => {
      const r = extractFromText('výztuž 150 kg/m3');
      expect(findParam(r, 'reinforcement_ratio_kg_m3')?.value).toBe(150);
    });

    it('extracts "140 kg/m³" (Unicode superscript) → 140', () => {
      const r = extractFromText('norma 140 kg/m³');
      expect(findParam(r, 'reinforcement_ratio_kg_m3')?.value).toBe(140);
    });

    it('extracts decimal "87,5 kg/m3" → 87.5', () => {
      const r = extractFromText('index 87,5 kg/m3 pro beton');
      expect(findParam(r, 'reinforcement_ratio_kg_m3')?.value).toBeCloseTo(87.5, 1);
    });
  });

  describe('extractFromText — smeta wins over free-text volume regex', () => {
    it('when text has both free-text "605 m³" AND smeta beton line → smeta wins', () => {
      const text = `
Celkový objem 605 m³ dle rozpočtu.

327323127  Beton stěn  m3  94,231
`;
      const r = extractFromText(text);
      const vol = findParam(r, 'volume_m3');
      expect(vol).toBeDefined();
      expect(vol!.source).toBe('smeta_line');
      expect(vol!.value).toBeCloseTo(94.231, 3);
      // Free-text regex's 605 must NOT override
      expect(vol!.value).not.toBe(605);
    });

    it('when text has only free-text "605 m³" (no smeta) → free-text fallback', () => {
      const r = extractFromText('Celkový objem 605 m³.');
      const vol = findParam(r, 'volume_m3');
      expect(vol).toBeDefined();
      expect(vol!.source).toBe('regex');
      expect(vol!.value).toBe(605);
    });
  });

  // ─── Task 2 (2026-04-20): exposure_classes multi-match ───────────────

  describe('exposure_classes — ČSN EN 206+A2 multi-match', () => {
    it('SO 204 TZ: "Expozice: XF2 (mostovka), XD1, XC4 (opěry v zemi)" → all 3', () => {
      const r = extractFromText('Expozice: XF2 (mostovka), XD1, XC4 (opěry v zemi).');
      const arr = findParam(r, 'exposure_classes');
      expect(arr).toBeDefined();
      expect(arr!.value).toEqual(expect.arrayContaining(['XF2', 'XD1', 'XC4']));
      expect((arr!.value as string[]).length).toBe(3);
      expect(arr!.confidence).toBe(1.0);
    });

    it('single class → array with one element', () => {
      const r = extractFromText('Beton C30/37 XF2.');
      const arr = findParam(r, 'exposure_classes');
      expect(arr).toBeDefined();
      expect(arr!.value).toEqual(['XF2']);
    });

    it('deduplicates repeated occurrences', () => {
      const r = extractFromText('XF2 na mostovce. Ve spodní stavbě také XF2 a XC4.');
      const arr = findParam(r, 'exposure_classes');
      expect(arr!.value).toEqual(expect.arrayContaining(['XF2', 'XC4']));
      expect((arr!.value as string[]).length).toBe(2);
    });

    it('recognises X0 (no catalog match before Task 2)', () => {
      const r = extractFromText('Podkladní beton X0 — bez rizika koroze.');
      const arr = findParam(r, 'exposure_classes');
      expect(arr).toBeDefined();
      expect(arr!.value).toEqual(['X0']);
    });

    it('exposure_class singular = most-restrictive (XF4 > XD1 > XC4)', () => {
      const r = extractFromText('Betonáž XC4, XD1 a XF4 dle specifikace.');
      const single = findParam(r, 'exposure_class');
      expect(single!.value).toBe('XF4');
    });

    it('singular confidence drops to 0.8 when multi-match collapsed', () => {
      const r = extractFromText('XC4, XF2');
      const single = findParam(r, 'exposure_class');
      expect(single!.confidence).toBe(0.8);
    });

    it('does NOT match invented "XD9" or stray "XG1"', () => {
      const r = extractFromText('Nějaký XD9 nebo XG1 nepatří do normy.');
      const arr = findParam(r, 'exposure_classes');
      expect(arr).toBeUndefined();
    });

    it('does NOT match inside a longer identifier like "XF2A" (word boundary)', () => {
      const r = extractFromText('Označení XF2A je interní kód, ne norma.');
      const arr = findParam(r, 'exposure_classes');
      expect(arr).toBeUndefined();
    });

    it('mostovka reálně: "C30/37 XF2 XD1 XC4 — LP" → 3 classes + C30/37', () => {
      const r = extractFromText('Mostovka: beton C30/37 XF2 XD1 XC4 — s provzdušněním (LP).');
      expect(findParam(r, 'concrete_class')?.value).toBe('C30/37');
      const arr = findParam(r, 'exposure_classes');
      expect(arr!.value).toEqual(expect.arrayContaining(['XF2', 'XD1', 'XC4']));
    });

    it('empty text → no exposure params at all (alternatives undefined too)', () => {
      const r = extractFromText('');
      expect(findParam(r, 'exposure_classes')).toBeUndefined();
      expect(findParam(r, 'exposure_class')).toBeUndefined();
    });
  });

  // ─── Task 3 (2026-04-20): conflict alternatives ──────────────────────

  describe('alternatives[] — conflict detection across multi-match', () => {
    it('two concrete classes C30/37 + C40/50 → primary C40/50 + alternatives[C30/37]', () => {
      const r = extractFromText('Nosná konstrukce C40/50, spodní stavba C30/37.');
      const p = findParam(r, 'concrete_class');
      expect(p).toBeDefined();
      expect(p!.value).toBe('C40/50');
      expect(p!.alternatives).toEqual(['C30/37']);
    });

    it('single concrete class → no alternatives surfaced', () => {
      const r = extractFromText('Celkově C30/37.');
      const p = findParam(r, 'concrete_class');
      expect(p!.alternatives).toBeUndefined();
    });

    it('three concrete classes → alternatives carries the remaining two', () => {
      const r = extractFromText('C50/60 + C30/37 + C20/25 — podklad.');
      const p = findParam(r, 'concrete_class');
      expect(p!.value).toBe('C50/60');
      expect(p!.alternatives).toEqual(['C30/37', 'C20/25']);
    });

    it('exposure_class singular surfaces alternatives when multi-match', () => {
      const r = extractFromText('Mostovka XF4, opěry v zemi XC2.');
      const p = findParam(r, 'exposure_class');
      expect(p).toBeDefined();
      expect(p!.value).toBe('XF4');
      expect(p!.alternatives).toEqual(['XC2']);
    });

    it('exposure_class singular alternatives undefined when only one class', () => {
      const r = extractFromText('Mostovka XF4.');
      const p = findParam(r, 'exposure_class');
      expect(p!.alternatives).toBeUndefined();
    });

    it('exposure_classes (plural) does NOT duplicate into alternatives', () => {
      // The plural array already expresses the full set; alternatives
      // only makes sense on the singular.
      const r = extractFromText('XF2, XD1, XC4.');
      const plural = findParam(r, 'exposure_classes');
      expect(plural).toBeDefined();
      expect((plural as any).alternatives).toBeUndefined();
    });
  });
});
