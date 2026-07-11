/**
 * Cross-path subtype parity (Gate 4 acceptance, spec Krit. 4): the SAME
 * budget row must classify identically no matter which import path it takes.
 *
 * Before Gate 4 the repo held THREE divergent local determineSubtype copies
 * with contradictory defaults (concreteExtractor: unit-first → beton;
 * import-from-registry: text-first → jiné; coreAPI: unit-substring → beton).
 * They are now thin delegates over the shared ADR-007 classifier, and this
 * test pins that the delegation is real — every wrapper returns exactly
 * classifyMonolithRow(...).sub_role, for the signal-ladder fixtures the
 * classifier's own golden tests use (marka, prefab veto, kamenivo, §451x
 * prostý beton, asphalt hard-reject, sub-work text over marka).
 *
 * NOTE: this suite deliberately does NOT mock @stavagent/monolit-shared —
 * parity against the REAL classifier is the point.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const { classifyMonolithRow } = await import('@stavagent/monolit-shared');
const { determineSubtype: extractorSubtype } = await import('../../src/services/concreteExtractor.js');
const { determineSubtype: coreApiSubtype } = await import('../../src/services/coreAPI.js');

/** [popis, mj, otskp_code, expected sub_role] — expected values double as a
 *  behavior pin so a shared-ladder regression is visible HERE too, not only
 *  in the shared vitest suite. */
const FIXTURES = [
  ['ZÁKLADY ZE ŽELEZOBETONU DO C25/30', 'm3', '273325', 'beton'],
  ['ZÁKLADY ZE ŽELEZOBETONU DO C25/30 VČETNĚ BEDNĚNÍ', 'm3', '273325', 'beton'],
  ['PATKY Z DÍLCŮ C25/30', 'm3', null, 'jiné'],                    // prefab veto beats marka
  ['VÝPLŇ ZA OPĚRAMI A ZDMI Z KAMENIVA DRCENÉHO', 'm3', '45852', 'jiné'],
  ['Podkladní beton', 'm3', '45123', 'beton'],                     // §451x prostý beton
  ['Asfaltový beton ACO 11', 'm3', '56452', 'jiné'],               // asphalt stays hard reject
  ['ZÁKLADY ZE ŽELEZOBETONU DO C25/30 - VÝZTUŽ B500B', 't', '273366', 'výztuž'],
  ['Bednění základů - zřízení', 'm2', '274351215', 'bednění'],
  ['Bednění základů - odstranění', 'm2', '274351216', 'bednění'],
  ['Betonáž stěn suterénu', 'm3', null, 'beton'],                  // weak m³+keyword signal
  ['Dilatační závěr povrchový', 'ks', '93152', 'jiné'],            // dil-regex must not fire
];

describe('subtype parity — one row, one result, every import path', () => {
  it.each(FIXTURES)('"%s" (%s, %s) → %s on every path', (popis, mj, code, expected) => {
    const shared = classifyMonolithRow({ item_name: popis, otskp_code: code, unit: mj }).sub_role;
    expect(shared).toBe(expected);
    expect(extractorSubtype(popis, mj, code)).toBe(shared);
    expect(coreApiSubtype(popis, mj, code)).toBe(shared);
  });

  it('wrappers stay thin: no local fallback survives a row with zero signals', () => {
    // The old copies defaulted differently here (beton vs jiné vs beton) —
    // now all three surfaces must agree with the shared fallback.
    const shared = classifyMonolithRow({ item_name: 'Položka bez popisu', otskp_code: null, unit: 'ks' }).sub_role;
    expect(extractorSubtype('Položka bez popisu', 'ks', null)).toBe(shared);
    expect(coreApiSubtype('Položka bez popisu', 'ks', null)).toBe(shared);
  });
});
