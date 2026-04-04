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
/** Three-point estimate for a single duration */
export interface ThreePointEstimate {
    optimistic: number;
    most_likely: number;
    pessimistic: number;
}
/** PERT calculation result for a single activity */
export interface PertEstimate {
    t_pert: number;
    sigma: number;
    variance: number;
    three_point: ThreePointEstimate;
}
/** Monte Carlo simulation result */
export interface MonteCarloResult {
    iterations: number;
    p50: number;
    p80: number;
    p90: number;
    p95: number;
    mean: number;
    std_dev: number;
    min: number;
    max: number;
    histogram: {
        bin: number;
        count: number;
    }[];
}
/** PERT parameters for the scheduler */
export interface PertParams {
    /** Multiplier for optimistic duration. Default 0.75 (25% faster) */
    optimistic_factor?: number;
    /** Multiplier for pessimistic duration. Default 1.50 (50% slower) */
    pessimistic_factor?: number;
    /** Number of Monte Carlo iterations. Default 10000 */
    monte_carlo_iterations?: number;
    /** Random seed for reproducibility (optional) */
    seed?: number;
}
/**
 * Calculate PERT weighted mean and variance from three-point estimate
 */
export declare function calculatePert(est: ThreePointEstimate): PertEstimate;
/**
 * Convert a single "most likely" duration to three-point estimate using factors
 */
export declare function toThreePoint(most_likely: number, optimistic_factor?: number, pessimistic_factor?: number): ThreePointEstimate;
/**
 * Calculate PERT for a path (sum of sequential activities)
 * Central Limit Theorem: total variance = sum of individual variances
 */
export declare function calculatePathPert(estimates: PertEstimate[]): {
    t_pert: number;
    sigma: number;
    variance: number;
    /** Probability of completing within a given duration */
    probabilityWithin: (duration: number) => number;
};
/**
 * Sample from triangular distribution
 * More appropriate for construction than beta — bounded, intuitive
 */
export declare function sampleTriangular(o: number, m: number, p: number, rng: () => number): number;
/**
 * Run Monte Carlo simulation for a set of activities on the critical path
 *
 * @param activities - Array of three-point estimates for each activity
 * @param iterations - Number of simulation iterations (default 10000)
 * @param seed - Optional seed for reproducible results
 */
export declare function runMonteCarlo(activities: ThreePointEstimate[], iterations?: number, seed?: number): MonteCarloResult;
