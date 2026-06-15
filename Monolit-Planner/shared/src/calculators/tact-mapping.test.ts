import { describe, it, expect } from 'vitest';
import { tactsPerSectionForRecommendedTotal } from './tact-mapping.js';

describe('tactsPerSectionForRecommendedTotal', () => {
  it('returns N unchanged with a single section', () => {
    expect(tactsPerSectionForRecommendedTotal(4, 1)).toBe(4);
    expect(tactsPerSectionForRecommendedTotal(7, 1)).toBe(7);
  });

  it('spreads N across sections exactly when divisible (total === N)', () => {
    const perSection = tactsPerSectionForRecommendedTotal(6, 3);
    expect(perSection).toBe(2);
    expect(perSection * 3).toBe(6); // total stays N
  });

  it('rounds up when not divisible so total >= N and is minimal', () => {
    const perSection = tactsPerSectionForRecommendedTotal(7, 3);
    expect(perSection).toBe(3); // ceil(7/3)
    expect(perSection * 3).toBeGreaterThanOrEqual(7); // never below N
    expect((perSection - 1) * 3).toBeLessThan(7); // minimal such per-section
  });

  it('handles the N=5 / 2-section case', () => {
    const perSection = tactsPerSectionForRecommendedTotal(5, 2);
    expect(perSection).toBe(3);
    expect(perSection * 2).toBeGreaterThanOrEqual(5);
  });

  it('guards against zero/garbage inputs (floors at 1)', () => {
    expect(tactsPerSectionForRecommendedTotal(0, 0)).toBe(1);
    expect(tactsPerSectionForRecommendedTotal(NaN, NaN)).toBe(1);
    expect(tactsPerSectionForRecommendedTotal(3, 0)).toBe(3); // sections coerced to 1
  });
});
