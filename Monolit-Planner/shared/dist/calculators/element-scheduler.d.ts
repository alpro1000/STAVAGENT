/**
 * Element Scheduler — Resource-Constrained Critical Path Method (RCPSP)
 *
 * Schedules multi-tact concrete construction elements as a DAG of activities
 * with resource constraints (formwork sets, crews).
 *
 * Graph theory model:
 *   Vertices = activities (5 per tact: ASM, REB, CON, CUR, STR)
 *   Edges = precedence constraints:
 *     Within tact:  ASM ──FS──→ CON → CUR → STR
 *                   REB ──FS──↗
 *                   ASM ──SS(lag)──→ REB  (rebar can overlap with assembly)
 *     Cross-tact:   STR(t) ──FS──→ ASM(t + num_sets)  (set reuse)
 *
 *   FS = finish-to-start, SS = start-to-start with lag
 *
 * Resources (capacity-constrained):
 *   - Formwork crews: shared by ASM + STR (configurable count)
 *   - Rebar crews: used by REB (configurable count)
 *   - Concrete pour: no crew constraint (1 day, all hands)
 *   - Curing: passive (no crew, set occupied)
 *
 * Algorithm: Priority List Scheduling (greedy forward pass)
 *   1. Build DAG with all activities and edges
 *   2. Repeatedly pick ready activity with earliest feasible start
 *   3. Schedule it, update crew availability
 *   4. Backward pass for critical path (slack = 0)
 *
 * Complexity: O(n²) where n = 5 × num_tacts. Fine for n < 500.
 */
import type { PertParams, MonteCarloResult } from './pert.js';
import type { ConcreteClass, CementType, ElementType } from './maturity.js';
export interface ElementScheduleInput {
    num_tacts: number;
    num_sets: number;
    assembly_days: number;
    rebar_days: number;
    concrete_days: number;
    curing_days: number;
    stripping_days: number;
    /** Prestressing duration (days). 0 or undefined = no prestressing. Added between CUR and STR. */
    prestress_days?: number;
    num_formwork_crews?: number;
    num_rebar_crews?: number;
    rebar_lag_pct?: number;
    per_tact_concrete_days?: number[];
    per_tact_rebar_days?: number[];
    per_tact_assembly_days?: number[];
    scheduling_mode?: 'linear' | 'chess';
    cure_between_neighbors_days?: number;
    pert_params?: PertParams;
    maturity_params?: {
        concrete_class: ConcreteClass;
        temperature_c: number;
        cement_type?: CementType;
        element_type?: ElementType;
    };
}
export interface TactDetail {
    tact: number;
    set: number;
    assembly: [number, number];
    rebar: [number, number];
    concrete: [number, number];
    curing: [number, number];
    /** Prestressing [start, finish]. Only present when prestress_days > 0. */
    prestress?: [number, number];
    stripping: [number, number];
}
export interface ElementScheduleOutput {
    total_days: number;
    sequential_days: number;
    savings_days: number;
    savings_pct: number;
    tact_details: TactDetail[];
    critical_path: string[];
    gantt: string;
    utilization: {
        formwork_crews: number;
        rebar_crews: number;
        sets: number[];
    };
    bottleneck: string | null;
    monte_carlo?: MonteCarloResult;
    effective_curing_days?: number;
}
export declare function scheduleElement(input: ElementScheduleInput): ElementScheduleOutput;
