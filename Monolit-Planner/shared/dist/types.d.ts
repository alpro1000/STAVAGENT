/**
 * Monolit Planner - Shared Types
 * Types used across backend and frontend
 */
export type Subtype = 'beton' | 'bednění' | 'odbednění' | 'výztuž' | 'jiné';
export type Unit = 'M3' | 'm2' | 'kg' | 'ks' | 't' | 'other';
export interface Position {
    id?: string;
    bridge_id: string;
    part_name: string;
    item_name?: string;
    subtype: Subtype;
    unit: Unit;
    qty: number;
    qty_m3_helper?: number;
    crew_size: number;
    wage_czk_ph: number;
    shift_hours: number;
    days: number;
    curing_days?: number;
    otskp_code?: string;
    labor_hours?: number;
    cost_czk?: number;
    unit_cost_native?: number;
    concrete_m3?: number;
    unit_cost_on_m3?: number;
    kros_unit_czk?: number;
    kros_total_czk?: number;
    position_instance_id?: string;
    metadata?: string;
    has_rfi?: boolean;
    rfi_message?: string;
    created_at?: string;
    updated_at?: string;
}
export interface HeaderKPI {
    span_length_m?: number;
    deck_width_m?: number;
    pd_weeks?: number;
    days_per_month_mode: 30 | 22;
    sum_concrete_m3: number;
    sum_kros_total_czk: number;
    project_unit_cost_czk_per_m3: number;
    project_unit_cost_czk_per_t: number;
    estimated_months: number;
    estimated_weeks: number;
    avg_crew_size: number;
    avg_wage_czk_ph: number;
    avg_shift_hours: number;
    days_per_month: number;
    rho_t_per_m3: number;
}
export interface Bridge {
    bridge_id: string;
    project_name?: string;
    object_name: string;
    element_count: number;
    concrete_m3: number;
    sum_kros_czk: number;
    span_length_m?: number;
    deck_width_m?: number;
    pd_weeks?: number;
    status?: 'active' | 'completed' | 'archived';
    created_at?: string;
    updated_at?: string;
    portal_project_id?: string;
    portal_linked_at?: string;
}
export interface MappingProfile {
    id?: string;
    name: string;
    description?: string;
    column_mapping: {
        [key: string]: string;
    };
    created_at?: string;
}
export interface ProjectConfig {
    feature_flags: {
        FF_AI_DAYS_SUGGEST: boolean;
        FF_PUMP_MODULE: boolean;
        FF_ADVANCED_METRICS: boolean;
        FF_DARK_MODE: boolean;
        FF_SPEED_ANALYSIS: boolean;
    };
    defaults: {
        ROUNDING_STEP_KROS: number;
        RHO_T_PER_M3: number;
        LOCALE: string;
        CURRENCY: string;
        DAYS_PER_MONTH_OPTIONS: number[];
        DAYS_PER_MONTH_DEFAULT: 30 | 22;
        DEFAULT_WAGE_CZK_PH: number;
        DEFAULT_SHIFT_HOURS: number;
    };
    days_per_month_mode: 30 | 22;
}
export interface RFIIssue {
    position_id: string;
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}
export interface ImportResult {
    import_id: string;
    bridges: string[];
    mapping_suggestions: Record<string, string>;
    raw_rows: any[];
    status: 'pending_mapping' | 'ready' | 'error';
}
export interface ExportOptions {
    bridge_id: string;
    format: 'xlsx' | 'csv';
    delimiter?: string;
    include_formulas?: boolean;
}
export interface Snapshot {
    id: string;
    bridge_id: string;
    snapshot_name?: string;
    snapshot_hash: string;
    created_at: string;
    created_by?: string;
    positions_snapshot: Position[];
    header_kpi_snapshot: HeaderKPI;
    description?: string;
    is_locked: boolean;
    is_final: boolean;
    parent_snapshot_id?: string;
    sum_kros_at_lock: number;
    delta_to_previous?: number;
}
export interface SnapshotListItem {
    snapshot_id: string;
    snapshot_name?: string;
    created_at: string;
    created_by?: string;
    sum_kros_at_lock: number;
    delta_to_previous: number | null;
    description?: string;
    is_locked: boolean;
    parent_snapshot_id?: string;
}
export interface SnapshotIntegrity {
    is_valid: boolean;
    hash_matches: boolean;
    stored_hash: string;
    calculated_hash: string;
    positions_count: number;
}
/**
 * OTSKP Code - Pricing catalog item
 * Represents a single item from the OTSKP (Czech construction pricing) catalog
 */
export interface OtskpCode {
    code: string;
    name: string;
    unit: string;
    unit_price: number;
    specification?: string;
    created_at?: string;
}
/**
 * OTSKP Search Result
 */
export interface OtskpSearchResult {
    query: string;
    count: number;
    results: OtskpCode[];
}
/**
 * SheathingCapture - Захватка для опалубки (шахматный метод)
 * Represents one sheathing capture unit for formwork calculations
 *
 * Шахматный метод (checkerboard method):
 * - Несколько захватки (kits) работают одновременно
 * - Каждая захватка проходит: сборка → бетонирование → разборка
 * - Временное смещение между захватками уменьшает общий срок проекта
 */
export interface SheathingCapture {
    id?: string;
    capture_id?: string;
    project_id: string;
    part_name: string;
    length_m: number;
    width_m: number;
    height_m?: number;
    area_m2: number;
    volume_m3?: number;
    assembly_norm_ph_m2: number;
    concrete_class?: string;
    concrete_curing_days: number;
    num_kits: number;
    kit_type?: string;
    daily_rental_cost_czk?: number;
    work_method: 'sequential' | 'staggered';
    single_cycle_days?: number;
    project_duration_days?: number;
    crew_size?: number;
    shift_hours?: number;
    days_per_month?: number;
    assembly_labor_hours?: number;
    disassembly_labor_hours?: number;
    total_rental_cost_czk?: number;
    created_at?: string;
    updated_at?: string;
}
/**
 * SheathingCalculationResult - Результат расчёта захватки
 * Вывод для UI и отчётов
 */
export interface SheathingCalculationResult {
    capture_id: string;
    part_name: string;
    area_m2: number;
    num_kits: number;
    work_method: 'sequential' | 'staggered';
    assembly_days: number;
    curing_days: number;
    disassembly_days: number;
    single_cycle_days: number;
    sequential_duration_days: number;
    staggered_duration_days: number;
    staggered_shift_days: number;
    time_savings_days?: number;
    time_savings_percent?: number;
    total_labor_hours: number;
    daily_crew_hours: number;
    crew_size: number;
    total_rental_cost_czk?: number;
    daily_rental_cost_czk?: number;
    summary: string;
}
/**
 * SheathingProjectConfig - Конфигурация проекта для расчётов захватки
 */
export interface SheathingProjectConfig {
    project_id: string;
    default_assembly_norm_ph_m2: number;
    default_concrete_curing_days: number;
    default_num_kits: number;
    default_work_method: 'sequential' | 'staggered';
    concrete_class_default?: string;
    daily_rental_cost_per_kit_czk?: number;
    crew_size: number;
    shift_hours: number;
    days_per_month: 22 | 30;
    created_at?: string;
    updated_at?: string;
}
/**
 * FormworkCalculatorRow - One row in the Formwork Calculator
 * Represents a formwork set for a specific construction element
 */
export interface FormworkCalculatorRow {
    id: string;
    bridge_id: string;
    construction_name: string;
    total_area_m2: number;
    set_area_m2: number;
    num_tacts: number;
    num_sets: number;
    assembly_days_per_tact: number;
    disassembly_days_per_tact: number;
    days_per_tact: number;
    formwork_term_days: number;
    system_name: string;
    system_height: string;
    rental_czk_per_m2_month: number;
    monthly_rental_per_set: number;
    final_rental_czk: number;
    kros_code?: string;
    kros_description?: string;
    created_at?: string;
    updated_at?: string;
}
/**
 * FormworkSystem - Pre-defined formwork system from catalog
 */
export interface FormworkSystem {
    name: string;
    manufacturer: string;
    heights: string[];
    rental_czk_m2_month: number;
    assembly_h_m2: number;
    disassembly_ratio: number;
    description?: string;
    unit?: 'm2' | 'bm';
}
