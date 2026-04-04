/**
 * Calculator Types
 * TypeScript interfaces for deterministic calculators with traceability
 */
/**
 * Traceability information for every calculation result
 */
export interface Traceability {
    source_tag: string;
    assumptions_log: string;
    confidence: number;
}
export interface RebarCalculatorParams {
    mass_t: number;
    norm_h_per_t: number;
    crew_size: number;
    shift_h: number;
    k: number;
    wage_czk_h: number;
    source_tag?: string;
    confidence?: number;
}
export interface RebarCalculatorResult extends Traceability {
    labor_hours: number;
    duration_days: number;
    cost_labor: number;
}
export interface FormworkCalculatorParams {
    area_m2: number;
    norm_assembly_h_m2: number;
    norm_disassembly_h_m2: number;
    crew_size: number;
    shift_h: number;
    k: number;
    wage_czk_h: number;
    strip_wait_hours: number;
    move_clean_hours: number;
    kits_count?: number;
    rental_czk_day?: number;
    source_tag?: string;
    confidence?: number;
}
export interface FormworkCalculatorResult extends Traceability {
    assembly_hours: number;
    disassembly_hours: number;
    assembly_days: number;
    disassembly_days: number;
    wait_days: number;
    move_clean_days: number;
    kit_occupancy_days: number;
    cost_labor: number;
}
export interface ConcretingCalculatorParams {
    volume_m3: number;
    q_eff_m3_h: number;
    setup_hours: number;
    washout_hours: number;
    crew_size: number;
    shift_h: number;
    wage_czk_h: number;
    pump_rate_czk_h: number;
    max_continuous_hours: number;
    source_tag?: string;
    confidence?: number;
}
export interface ConcretingCalculatorResult extends Traceability {
    pour_hours: number;
    pour_days: number;
    cost_labor: number;
    cost_pump: number;
    exceeds_continuous_window: boolean;
    warning: string | null;
}
export interface Task {
    id: string;
    capture_id: string;
    normset_id: string;
    type: 'rebar' | 'formwork_in' | 'pour' | 'wait_strip' | 'formwork_out' | 'move_clean';
    sequence: number;
    description: string;
    duration_hours: number;
    duration_days: number;
    labor_hours: number;
    cost_labor: number;
    cost_machine: number;
    cost_rental: number;
    crew_size: number;
    resources_required: Record<string, any>;
    source_tag: string;
    norm_used: string;
    assumptions_log: string;
    confidence: number;
    predecessors?: string[];
}
export interface ScheduleEntry {
    task_id: string;
    start_day: number;
    end_day: number;
    resources_used: Record<string, any>;
    is_critical?: boolean;
    slack_days?: number;
}
export interface Resources {
    crew_rebar_count: number;
    crew_formwork_count: number;
    crew_concreting_count: number;
    formwork_kits_count: number;
    pumps_count: number;
    shift_hours: number;
    days_per_month: number;
}
export interface Calendar {
    start_date?: Date;
    working_days?: number[];
    holidays?: Date[];
}
export interface Bottleneck {
    id: string;
    type: 'POUR_EXCEEDS_SHIFT' | 'FORMWORK_BOTTLENECK' | 'PUMP_UNDERUTILIZED' | 'WAITING_ON_CRITICAL_PATH' | 'CREW_IDLE';
    severity: 'ERROR' | 'WARNING' | 'INFO';
    task_id?: string;
    message: string;
    suggestion: string;
    status?: 'open' | 'acknowledged' | 'resolved';
}
