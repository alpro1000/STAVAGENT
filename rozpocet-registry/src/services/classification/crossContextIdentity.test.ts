/**
 * Cross-context identity test
 *
 * Verifies that the frontend classifier (`classifyItem` from
 * src/services/classification/classificationRules.ts) and the serverless
 * classifier (`classifyByRules` from api/agent/rules.ts) produce the SAME
 * `skupina` decision for the same input.
 *
 * Both paths now consume the same rule data and the same scoring algorithm,
 * so this test acts as a regression guard against future drift.
 *
 * Edge cases covered (per Gate 5 spec):
 *   - empty description
 *   - Czech with diacritics
 *   - Czech without diacritics
 *   - description containing an ÚRS / OTSKP code prefix
 *   - long mixed description
 *   - PILOTY absolute-priority case (pilot + beton)
 *   - KOTVENÍ over VÝZTUŽ priority case
 *   - LOŽISKA precise rule
 *   - prefab vs monolit disambiguation
 *   - DOPRAVA vs BETON_MONOLIT priorityOver case
 */

import { describe, it, expect } from 'vitest';
import { CLASSIFICATION_RULES, classifyItem } from './classificationRules';
import { DEFAULT_GROUPS } from '../../utils/constants';
import { classifyByRules } from '../../../api/agent/rules';
import type { RowPack } from '../../../api/agent/types';

function makeRowPack(mainText: string, childText = ''): RowPack {
  return {
    main_text: mainText,
    child_text: childText,
    meta: {
      itemId: 'test',
      kod: '',
      projectId: 'test',
      sheetId: 'test',
      rowNumber: 0,
      language: 'cs',
    },
    hash: 'test',
  };
}

interface Case {
  label: string;
  text: string;
  expected: string | null; // null = no classification
}

const CASES: Case[] = [
  { label: 'empty description', text: '', expected: null },
  { label: 'whitespace only', text: '   ', expected: null },
  { label: 'plain Czech with diacritics — výkopy', text: 'Výkopy zeminy třídy 3 v rýhách', expected: 'ZEMNÍ_PRÁCE' },
  { label: 'ASCII Czech — vykopy', text: 'Vykopy zeminy tridy 3 v ryhach', expected: 'ZEMNÍ_PRÁCE' },
  { label: 'monolit beton C30/37 with grade hint', text: 'Beton C30/37 monolitický pro stropní desku', expected: 'BETON_MONOLIT' },
  { label: 'monolit with diacritics', text: 'Železobeton stropní desky C30/37', expected: 'BETON_MONOLIT' },
  { label: 'prefab obrubníky', text: 'Osazení betonových obrubníků z dílců', expected: 'BETON_PREFAB' },
  { label: 'výztuž B500B', text: 'Výztuž betonářská ocel B500B', expected: 'VÝZTUŽ' },
  { label: 'výztuž ASCII', text: 'Vyztuz betonarska ocel B500B', expected: 'VÝZTUŽ' },
  { label: 'kotvení injektáž (priority over výztuž)', text: 'Injektované trvalé kotvy s napínáním', expected: 'KOTVENÍ' },
  { label: 'bednění systémové', text: 'Systémové bednění stěn', expected: 'BEDNĚNÍ' },
  { label: 'piloty absolute priority — even with beton', text: 'Betonování velkoprůměrových pilot Ø1200 mm', expected: 'PILOTY' },
  { label: 'piloty pure', text: 'Vrtané piloty Ø900', expected: 'PILOTY' },
  { label: 'mikropilot', text: 'Mikropilota injektovaná', expected: 'PILOTY' },
  { label: 'izolace hydroizolace', text: 'Hydroizolace asfaltovými pásy', expected: 'IZOLACE' },
  { label: 'komunikace asfalt', text: 'Vozovka asfaltová obrusná vrstva', expected: 'KOMUNIKACE' },
  { label: 'doprava betonu (priority over BETON_MONOLIT)', text: 'Doprava betonu autodomíchávač do 10 km', expected: 'DOPRAVA' },
  { label: 'ložiska kalotová', text: 'Kalotové ložisko mostní 500 kN', expected: 'LOŽISKA' },
  { label: 'ložiska elastomerová', text: 'Elastomerová ložiska mostní', expected: 'LOŽISKA' },
  { label: 'ÚRS-coded position', text: '121133011 Výkopy v hornině třídy 3 v jamách', expected: 'ZEMNÍ_PRÁCE' },
  // Multi-keyword description — VÝZTUŽ wins because BETON_MONOLIT excludes both
  // 'bedneni' and 'vyztuz' (-2.0 each), driving its score negative; VÝZTUŽ matches
  // 'vyztuz' as substring of 'výztuže' with no exclusion. Both contexts agree.
  { label: 'multi-keyword: beton + bednění + výztuže', text: 'Beton C25/30 železobetonové opěrné zdi tloušťky 0,4 m včetně bednění a výztuže', expected: 'VÝZTUŽ' },
  { label: 'unrelated freetext (null)', text: 'Geodetické zaměření terénu', expected: null },
];

describe('cross-context classification identity', () => {
  it.each(CASES)('"$label" — frontend === backend', ({ text, expected }) => {
    const fe = classifyItem(text);
    const beResult = classifyByRules(makeRowPack(text));
    const be = beResult ? beResult.skupina : null;

    // Sanity: matches expected value (catches data regressions too)
    expect({ case: text, fe }).toEqual({ case: text, fe: expected });

    // Core invariant: the two contexts agree
    expect({ case: text, fe, be }).toEqual({ case: text, fe: expected, be: expected });
  });

  it('every rule skupina is in the canonical 11-group list', () => {
    // Sanity check — guards against future drift between
    // CLASSIFICATION_RULES.skupina values and DEFAULT_GROUPS.
    const allowed = new Set<string>(DEFAULT_GROUPS);
    for (const rule of CLASSIFICATION_RULES) {
      expect(allowed.has(rule.skupina)).toBe(true);
    }
  });

  it('classifyByRules returns null on empty input (no fallback skupina)', () => {
    expect(classifyByRules(makeRowPack(''))).toBeNull();
    expect(classifyByRules(makeRowPack('   '))).toBeNull();
  });
});
