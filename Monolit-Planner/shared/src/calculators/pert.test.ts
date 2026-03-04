/**
 * PERT Module Tests
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePert,
  toThreePoint,
  calculatePathPert,
  sampleTriangular,
  runMonteCarlo,
  type ThreePointEstimate,
} from './pert';

describe('PERT — Three-Point Estimation', () => {
  // ─── calculatePert ──────────────────────────────────────────────

  describe('calculatePert', () => {
    it('should calculate weighted mean (o+4m+p)/6', () => {
      const est: ThreePointEstimate = { optimistic: 4, most_likely: 6, pessimistic: 14 };
      const result = calculatePert(est);
      // t_PERT = (4 + 24 + 14) / 6 = 42 / 6 = 7.0
      expect(result.t_pert).toBe(7);
      // σ = (14 - 4) / 6 = 10/6 ≈ 1.67
      expect(result.sigma).toBeCloseTo(1.67, 1);
      // σ² ≈ 2.78
      expect(result.variance).toBeCloseTo(2.78, 1);
    });

    it('should handle symmetric estimate', () => {
      const est: ThreePointEstimate = { optimistic: 3, most_likely: 5, pessimistic: 7 };
      const result = calculatePert(est);
      expect(result.t_pert).toBe(5);
      expect(result.sigma).toBeCloseTo(0.67, 1);
    });

    it('should handle zero-range (deterministic)', () => {
      const est: ThreePointEstimate = { optimistic: 5, most_likely: 5, pessimistic: 5 };
      const result = calculatePert(est);
      expect(result.t_pert).toBe(5);
      expect(result.sigma).toBe(0);
      expect(result.variance).toBe(0);
    });

    it('should throw if optimistic > most_likely', () => {
      expect(() => calculatePert({ optimistic: 10, most_likely: 5, pessimistic: 15 }))
        .toThrow('optimistic must be ≤ most_likely');
    });

    it('should throw if most_likely > pessimistic', () => {
      expect(() => calculatePert({ optimistic: 3, most_likely: 10, pessimistic: 8 }))
        .toThrow('most_likely must be ≤ pessimistic');
    });

    it('should throw on negative values', () => {
      expect(() => calculatePert({ optimistic: -1, most_likely: 5, pessimistic: 10 }))
        .toThrow('non-negative');
    });
  });

  // ─── toThreePoint ──────────────────────────────────────────────

  describe('toThreePoint', () => {
    it('should apply default factors (0.75, 1.50)', () => {
      const tp = toThreePoint(10);
      expect(tp.optimistic).toBe(7.5);
      expect(tp.most_likely).toBe(10);
      expect(tp.pessimistic).toBe(15);
    });

    it('should apply custom factors', () => {
      const tp = toThreePoint(10, 0.8, 1.3);
      expect(tp.optimistic).toBe(8);
      expect(tp.most_likely).toBe(10);
      expect(tp.pessimistic).toBe(13);
    });
  });

  // ─── calculatePathPert ────────────────────────────────────────

  describe('calculatePathPert', () => {
    it('should sum t_pert and variances for a path', () => {
      const estimates = [
        calculatePert({ optimistic: 4, most_likely: 6, pessimistic: 14 }),
        calculatePert({ optimistic: 3, most_likely: 5, pessimistic: 7 }),
      ];
      const path = calculatePathPert(estimates);
      // Total t_pert = 7 + 5 = 12
      expect(path.t_pert).toBe(12);
      // Total variance = 2.78 + 0.44 ≈ 3.22
      expect(path.variance).toBeCloseTo(3.22, 1);
      // σ = sqrt(3.22) ≈ 1.79
      expect(path.sigma).toBeCloseTo(1.79, 1);
    });

    it('should compute probability correctly', () => {
      const estimates = [
        calculatePert({ optimistic: 3, most_likely: 5, pessimistic: 7 }),
      ];
      const path = calculatePathPert(estimates);
      // P(finish ≤ 5) should be ~50% (symmetric)
      expect(path.probabilityWithin(5)).toBeCloseTo(0.5, 1);
      // P(finish ≤ 7) should be > 95%
      expect(path.probabilityWithin(7)).toBeGreaterThan(0.95);
      // P(finish ≤ 3) should be < 5%
      expect(path.probabilityWithin(3)).toBeLessThan(0.05);
    });

    it('should return 1.0 for deterministic estimates at or above t_pert', () => {
      const estimates = [
        calculatePert({ optimistic: 5, most_likely: 5, pessimistic: 5 }),
      ];
      const path = calculatePathPert(estimates);
      expect(path.probabilityWithin(5)).toBe(1);
      expect(path.probabilityWithin(4)).toBe(0);
    });
  });

  // ─── sampleTriangular ────────────────────────────────────────

  describe('sampleTriangular', () => {
    it('should return mode when range is 0', () => {
      expect(sampleTriangular(5, 5, 5, Math.random)).toBe(5);
    });

    it('should stay within bounds', () => {
      const rng = () => Math.random();
      for (let i = 0; i < 100; i++) {
        const v = sampleTriangular(2, 5, 10, rng);
        expect(v).toBeGreaterThanOrEqual(2);
        expect(v).toBeLessThanOrEqual(10);
      }
    });

    it('should return optimistic at u=0', () => {
      const v = sampleTriangular(2, 5, 10, () => 0);
      expect(v).toBe(2);
    });

    it('should approach pessimistic at u≈1', () => {
      const v = sampleTriangular(2, 5, 10, () => 0.9999);
      expect(v).toBeCloseTo(10, 0);
    });
  });

  // ─── runMonteCarlo ────────────────────────────────────────────

  describe('runMonteCarlo', () => {
    it('should produce reasonable percentiles with seeded RNG', () => {
      const activities: ThreePointEstimate[] = [
        { optimistic: 3, most_likely: 5, pessimistic: 10 },
        { optimistic: 2, most_likely: 4, pessimistic: 8 },
        { optimistic: 1, most_likely: 2, pessimistic: 5 },
      ];
      const result = runMonteCarlo(activities, 10000, 42);

      // Total most likely = 5+4+2 = 11
      // P50 should be near the mean
      expect(result.p50).toBeGreaterThan(9);
      expect(result.p50).toBeLessThan(15);
      // P90 > P50
      expect(result.p90).toBeGreaterThan(result.p50);
      // P95 > P90
      expect(result.p95).toBeGreaterThan(result.p90);
      // Min ≥ sum of optimistics (3+2+1=6)
      expect(result.min).toBeGreaterThanOrEqual(6);
      // Max ≤ sum of pessimistics (10+8+5=23)
      expect(result.max).toBeLessThanOrEqual(23);
    });

    it('should be reproducible with same seed', () => {
      const activities: ThreePointEstimate[] = [
        { optimistic: 4, most_likely: 6, pessimistic: 10 },
      ];
      const r1 = runMonteCarlo(activities, 5000, 123);
      const r2 = runMonteCarlo(activities, 5000, 123);
      expect(r1.p50).toBe(r2.p50);
      expect(r1.p90).toBe(r2.p90);
      expect(r1.mean).toBe(r2.mean);
    });

    it('should return correct iteration count', () => {
      const result = runMonteCarlo([{ optimistic: 1, most_likely: 2, pessimistic: 3 }], 500, 1);
      expect(result.iterations).toBe(500);
    });

    it('should produce histogram with 10 bins', () => {
      const result = runMonteCarlo(
        [{ optimistic: 1, most_likely: 5, pessimistic: 10 }],
        1000, 7,
      );
      expect(result.histogram).toHaveLength(10);
      const totalCount = result.histogram.reduce((s, h) => s + h.count, 0);
      expect(totalCount).toBe(1000);
    });

    it('should handle single deterministic activity', () => {
      const result = runMonteCarlo(
        [{ optimistic: 5, most_likely: 5, pessimistic: 5 }],
        100, 1,
      );
      expect(result.p50).toBe(5);
      expect(result.mean).toBe(5);
      expect(result.std_dev).toBe(0);
    });
  });
});
