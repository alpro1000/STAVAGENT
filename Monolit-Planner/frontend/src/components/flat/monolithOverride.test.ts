/**
 * Bug monolit-oznacit-beton-subtype — named tests for the ✓/✗ toggle patch
 * (Alexander verdict 2026-07-18, variant (а)): promote ALWAYS sets
 * subtype='beton', the unit never gates it.
 */
import { describe, expect, it } from 'vitest';

import { buildMonolithOverridePatch } from './monolithOverride';

describe('buildMonolithOverridePatch — variant (а)', () => {
  it('NAMED CASE (verdict): non-m³ rep row (unit «t») still gets subtype=beton on promote', () => {
    // The live bug: «VÝZTUŽ 10505, 2,5 t» group promoted via ✓ kept
    // subtype='jiné' → green check with no beton row, no «Vypočítat»,
    // beton works unreachable forever.
    const patch = buildMonolithOverridePatch(
      { id: 'p1', subtype: 'jiné', metadata: null },
      true,
    )!;
    expect(patch.subtype).toBe('beton');
    expect(JSON.parse(patch.metadata as string)).toEqual({ is_monolith_override: true });
  });

  it('promote on an already-beton rep touches only metadata (no redundant subtype write)', () => {
    const patch = buildMonolithOverridePatch(
      { id: 'p1', subtype: 'beton', metadata: null },
      true,
    )!;
    expect('subtype' in patch).toBe(false);
    expect(JSON.parse(patch.metadata as string)).toEqual({ is_monolith_override: true });
  });

  it('demote (override=false) never rewrites subtype — the predicate veto excludes the group', () => {
    const patch = buildMonolithOverridePatch(
      { id: 'p1', subtype: 'beton', metadata: '{"foo": 1}' },
      false,
    )!;
    expect('subtype' in patch).toBe(false);
    expect(JSON.parse(patch.metadata as string)).toEqual({ foo: 1, is_monolith_override: false });
  });

  it('reset (null) deletes the override key and preserves other metadata', () => {
    const patch = buildMonolithOverridePatch(
      { id: 'p1', subtype: 'jiné', metadata: '{"is_monolith_override": true, "keep": "me"}' },
      null,
    )!;
    expect('subtype' in patch).toBe(false);
    expect(JSON.parse(patch.metadata as string)).toEqual({ keep: 'me' });
  });

  it('unparseable string metadata degrades to a fresh object; missing id → null', () => {
    const patch = buildMonolithOverridePatch(
      { id: 'p1', subtype: 'jiné', metadata: '{broken' },
      true,
    )!;
    expect(JSON.parse(patch.metadata as string)).toEqual({ is_monolith_override: true });
    expect(buildMonolithOverridePatch({ subtype: 'jiné' }, true)).toBeNull();
    expect(buildMonolithOverridePatch(undefined, true)).toBeNull();
  });
});
