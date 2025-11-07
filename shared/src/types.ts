/**
 * Monolit Planner - Shared Types
 * Types used across backend and frontend
 */

export type Subtype =
  | 'beton'
  | 'bednění'
  | 'oboustranné (opěry)'
  | 'oboustranné (křídla)'
  | 'oboustranné (závěrné zídky)'
  | 'výztuž'
  | 'jiné';

export type Unit = 'M3' | 'm2' | 'kg' | 'ks' | 't' | 'other';

export interface Position {
  id?: string;
  bridge_id: string;              // SO201, SO202...
  part_name: string;              // ZÁKLADY, ŘÍMSY, OPĚRY...
  subtype: Subtype;
  unit: Unit;
  qty: number;                    // Quantity in native unit
  qty_m3_helper?: number;         // Helper field for area/volume reference
  crew_size: number;              // lidi (jedna parta)
  wage_czk_ph: number;            // Kč/hod
  shift_hours: number;            // Hod/den
  days: number;                   // den (koef 1)

  // Calculated fields
  labor_hours?: number;           // Celkový počet hodin
  cost_czk?: number;              // celkem (CZK)
  unit_cost_native?: number;      // Kč/MJ (native unit)
  concrete_m3?: number;           // Concrete volume of this part
  unit_cost_on_m3?: number;       // Kč/m³ (KEY METRIC!)
  kros_unit_czk?: number;         // KROS — JC práce
  kros_total_czk?: number;        // KROS celkem

  // Metadata
  has_rfi?: boolean;
  rfi_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HeaderKPI {
  // Input parameters
  span_length_m?: number;
  deck_width_m?: number;
  pd_weeks?: number;
  days_per_month_mode: 30 | 22;

  // Calculated sums
  sum_concrete_m3: number;
  sum_kros_total_czk: number;

  // Unit costs
  project_unit_cost_czk_per_m3: number;
  project_unit_cost_czk_per_t: number;

  // Duration calculations ⭐ NEW
  estimated_months: number;
  estimated_weeks: number;

  // Weighted averages
  avg_crew_size: number;
  avg_wage_czk_ph: number;
  avg_shift_hours: number;
  days_per_month: number;

  // Constants
  rho_t_per_m3: number;
}

export interface Bridge {
  bridge_id: string;
  element_count: number;
  concrete_m3: number;
  sum_kros_czk: number;
  span_length_m?: number;
  deck_width_m?: number;
  pd_weeks?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MappingProfile {
  id?: string;
  name: string;
  description?: string;
  column_mapping: {
    [key: string]: string;  // sourceColumn -> targetField
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
