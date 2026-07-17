/**
 * Completeness pin: the hand-maintained UI element-type dropdown MUST cover
 * the engine's full StructuralElementType union — both directions.
 *
 * Third occurrence of the engine-only-type class forced this pin
 * (2026-07-17, Alexander live finding): uzavreny_ram_tubus existed in the
 * engine + MCP but not in the manual ELEMENT_TYPES options array — exactly
 * like kridla_opery/zaklady_oper before it (2026-07-07 live-test finding).
 * The options array is a plain array, so tsc's exhaustive-Record discipline
 * never fires here; this test is the missing enforcement. A 25th element
 * type that lands in the engine without a dropdown entry fails HERE, with
 * the type named, instead of silently shipping an unselectable type.
 */
import { describe, expect, it } from 'vitest';
import { ELEMENT_DEFAULTS } from '@stavagent/monolit-shared';

import { ELEMENT_TYPES } from './types';

describe('element-type dropdown ≡ engine union', () => {
  const engineTypes = new Set<string>(Object.keys(ELEMENT_DEFAULTS));
  const uiTypes = new Set<string>(ELEMENT_TYPES.map(t => t.value));

  it('every engine type is selectable in the UI (no engine-only types)', () => {
    const missing = [...engineTypes].filter(t => !uiTypes.has(t));
    expect(missing, `engine types missing from the dropdown: ${missing}`).toEqual([]);
  });

  it('every dropdown entry is a real engine type (no dead options)', () => {
    const dead = [...uiTypes].filter(t => !engineTypes.has(t));
    expect(dead, `dropdown options unknown to the engine: ${dead}`).toEqual([]);
  });

  it('uzavreny_ram_tubus sits in the Mostní prvky group (the live finding)', () => {
    const entry = ELEMENT_TYPES.find(t => t.value === 'uzavreny_ram_tubus');
    expect(entry?.group).toBe('Mostní prvky');
    expect(entry?.label).toContain('Uzavřený rám');
  });
});
