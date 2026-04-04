/**
 * PERT (Program Evaluation and Review Technique)
 *
 * Three-point estimation for activity durations:
 *   t_PERT = (o + 4m + p) / 6     (weighted mean, beta distribution)
 *   σ      = (p - o) / 6          (standard deviation)
 *   σ²     = ((p - o) / 6)²       (variance)
 *
 * Monte Carlo simulation:
 *   - Triangular distribution per activity (faster, sufficient for construction)
 *   - N iterations (default 10,000) → P50, P80, P90 completion dates
 *
 * Integration:
 *   - Each activity in ElementScheduleInput can provide optimistic/pessimistic multipliers
 *   - Default: optimistic = 0.75 × most_likely, pessimistic = 1.50 × most_likely
 *   - For Monte Carlo: sample from triangular(o, m, p) per activity per iteration
 *
 * Reference: PMI PMBOK 6th Ed., Section 6.4.2.4
 */
// ─── Core PERT Calculations ─────────────────────────────────────────────────
/**
 * Calculate PERT weighted mean and variance from three-point estimate
 */
export function calculatePert(est) {
    if (est.optimistic < 0 || est.most_likely < 0 || est.pessimistic < 0) {
        throw new Error('All duration estimates must be non-negative');
    }
    if (est.optimistic > est.most_likely) {
        throw new Error('optimistic must be ≤ most_likely');
    }
    if (est.most_likely > est.pessimistic) {
        throw new Error('most_likely must be ≤ pessimistic');
    }
    const t_pert = (est.optimistic + 4 * est.most_likely + est.pessimistic) / 6;
    const sigma = (est.pessimistic - est.optimistic) / 6;
    const variance = sigma * sigma;
    return {
        t_pert: round(t_pert),
        sigma: round(sigma),
        variance: round(variance),
        three_point: est,
    };
}
/**
 * Convert a single "most likely" duration to three-point estimate using factors
 */
export function toThreePoint(most_likely, optimistic_factor = 0.75, pessimistic_factor = 1.50) {
    return {
        optimistic: round(most_likely * optimistic_factor),
        most_likely: round(most_likely),
        pessimistic: round(most_likely * pessimistic_factor),
    };
}
/**
 * Calculate PERT for a path (sum of sequential activities)
 * Central Limit Theorem: total variance = sum of individual variances
 */
export function calculatePathPert(estimates) {
    const totalPert = estimates.reduce((sum, e) => sum + e.t_pert, 0);
    const totalVariance = estimates.reduce((sum, e) => sum + e.variance, 0);
    const totalSigma = Math.sqrt(totalVariance);
    return {
        t_pert: round(totalPert),
        sigma: round(totalSigma),
        variance: round(totalVariance),
        probabilityWithin(duration) {
            if (totalSigma === 0)
                return duration >= totalPert ? 1 : 0;
            const z = (duration - totalPert) / totalSigma;
            return normalCDF(z);
        },
    };
}
// ─── Monte Carlo Simulation ─────────────────────────────────────────────────
/**
 * Sample from triangular distribution
 * More appropriate for construction than beta — bounded, intuitive
 */
export function sampleTriangular(o, m, p, rng) {
    const u = rng();
    const range = p - o;
    if (range === 0)
        return m;
    const fc = (m - o) / range; // mode position as fraction
    if (u < fc) {
        return o + Math.sqrt(u * range * (m - o));
    }
    else {
        return p - Math.sqrt((1 - u) * range * (p - m));
    }
}
/**
 * Run Monte Carlo simulation for a set of activities on the critical path
 *
 * @param activities - Array of three-point estimates for each activity
 * @param iterations - Number of simulation iterations (default 10000)
 * @param seed - Optional seed for reproducible results
 */
export function runMonteCarlo(activities, iterations = 10000, seed) {
    const rng = seed !== undefined ? seededRng(seed) : Math.random;
    const totals = new Array(iterations);
    for (let i = 0; i < iterations; i++) {
        let total = 0;
        for (const act of activities) {
            total += sampleTriangular(act.optimistic, act.most_likely, act.pessimistic, rng);
        }
        totals[i] = total;
    }
    // Sort for percentile calculation
    totals.sort((a, b) => a - b);
    const mean = totals.reduce((s, v) => s + v, 0) / iterations;
    const variance = totals.reduce((s, v) => s + (v - mean) ** 2, 0) / iterations;
    const std_dev = Math.sqrt(variance);
    // Histogram (10 bins)
    const min = totals[0];
    const max = totals[iterations - 1];
    const binCount = 10;
    const binWidth = (max - min) / binCount || 1;
    const histogram = [];
    for (let b = 0; b < binCount; b++) {
        histogram.push({ bin: round(min + b * binWidth), count: 0 });
    }
    for (const t of totals) {
        const idx = Math.min(Math.floor((t - min) / binWidth), binCount - 1);
        histogram[idx].count++;
    }
    return {
        iterations,
        p50: round(percentile(totals, 0.50)),
        p80: round(percentile(totals, 0.80)),
        p90: round(percentile(totals, 0.90)),
        p95: round(percentile(totals, 0.95)),
        mean: round(mean),
        std_dev: round(std_dev),
        min: round(min),
        max: round(max),
        histogram,
    };
}
// ─── Helpers ────────────────────────────────────────────────────────────────
function percentile(sorted, p) {
    const idx = p * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper)
        return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}
/** Standard normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(z) {
    if (z < -6)
        return 0;
    if (z > 6)
        return 1;
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
}
/** Simple seeded PRNG (Mulberry32) for reproducible Monte Carlo */
function seededRng(seed) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function round(v) {
    return Math.round(v * 100) / 100;
}
