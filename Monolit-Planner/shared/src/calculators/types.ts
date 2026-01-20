/**
 * Calculator Types
 * TypeScript interfaces for deterministic calculators with traceability
 */

// ============================================
// TRACEABILITY
// ============================================

/**
 * Traceability information for every calculation result
 */
export interface Traceability {
  source_tag: string;           // "URS_2024_OFFICIAL" / "RTS_2023" / "USER" / "AI_PROPOSED"
  assumptions_log: string;      // "crew=4, k=0.8, shift=10h, wage=398 CZK/h"
  confidence: number;           // 0.0-1.0
}

// ============================================
// REBAR CALCULATOR
// ============================================

export interface RebarCalculatorParams {
  // Quantity
  mass_t: number;               // Масса арматуры (т)

  // Norms
  norm_h_per_t: number;         // Норма часов на 1 тонну

  // Work regime
  crew_size: number;            // Размер бригады
  shift_h: number;              // Длительность смены (ч)
  k: number;                    // Коэффициент использования времени

  // Cost
  wage_czk_h: number;           // Ставка (CZK/ч)

  // Traceability (optional)
  source_tag?: string;
  confidence?: number;
}

export interface RebarCalculatorResult extends Traceability {
  // Calculated fields
  labor_hours: number;          // Трудозатраты (ч)
  duration_days: number;        // Длительность (дни)
  cost_labor: number;           // Стоимость труда (CZK)
}

// ============================================
// FORMWORK CALCULATOR
// ============================================

export interface FormworkCalculatorParams {
  // Quantity
  area_m2: number;              // Площадь опалубки (м²)

  // Norms
  norm_assembly_h_m2: number;   // Норма монтажа (ч/м²)
  norm_disassembly_h_m2: number; // Норма демонтажа (ч/м²)

  // Work regime
  crew_size: number;            // Размер бригады
  shift_h: number;              // Длительность смены (ч)
  k: number;                    // Коэффициент использования времени

  // Cost
  wage_czk_h: number;           // Ставка (CZK/ч)

  // Technological parameters
  strip_wait_hours: number;     // Выдержка до распалубки (ч)
  move_clean_hours: number;     // Перестановка и очистка (ч)

  // Resources
  kits_count?: number;          // Количество комплектов опалубки (optional, for bottleneck analysis)
  rental_czk_day?: number;      // Аренда комплекта (CZK/день) - NOTE: actual cost calculated in Schedule!

  // Traceability (optional)
  source_tag?: string;
  confidence?: number;
}

export interface FormworkCalculatorResult extends Traceability {
  // Calculated fields
  assembly_hours: number;       // Монтаж (ч)
  disassembly_hours: number;    // Демонтаж (ч)
  assembly_days: number;        // Монтаж (дни)
  disassembly_days: number;     // Демонтаж (дни)
  wait_days: number;            // Выдержка (дни)
  move_clean_days: number;      // Перестановка (дни)
  kit_occupancy_days: number;   // Занятость комплекта (дни)

  cost_labor: number;           // Стоимость труда (CZK)
  // NOTE: cost_rental calculated in Schedule Engine based on calendar!
}

// ============================================
// CONCRETING (PUMP) CALCULATOR
// ============================================

export interface ConcretingCalculatorParams {
  // Quantity
  volume_m3: number;            // Объём бетона (м³)

  // Pump parameters
  q_eff_m3_h: number;           // Эффективная производительность насоса (м³/ч)
  setup_hours: number;          // Подготовка (ч)
  washout_hours: number;        // Промывка (ч)

  // Work regime
  crew_size: number;            // Размер бригады
  shift_h: number;              // Длительность смены (ч)

  // Cost
  wage_czk_h: number;           // Ставка (CZK/ч)
  pump_rate_czk_h: number;      // Стоимость насоса (CZK/ч)

  // Constraints
  max_continuous_hours: number; // Макс. окно непрерывности (ч)

  // Traceability (optional)
  source_tag?: string;
  confidence?: number;
}

export interface ConcretingCalculatorResult extends Traceability {
  // Calculated fields
  pour_hours: number;           // Время бетонирования (ч)
  pour_days: number;            // Длительность (дни)
  cost_labor: number;           // Стоимость труда (CZK)
  cost_pump: number;            // Стоимость насоса (CZK)

  // Validation
  exceeds_continuous_window: boolean; // true если превышено окно
  warning: string | null;       // Предупреждение или null
}

// ============================================
// TASK (Generated from capture + calculator)
// ============================================

export interface Task {
  id: string;
  capture_id: string;
  normset_id: string;

  // Classification
  type: 'rebar' | 'formwork_in' | 'pour' | 'wait_strip' | 'formwork_out' | 'move_clean';
  sequence: number;             // 1, 2, 3, 4, 5, 6
  description: string;

  // Calculated fields (from calculators)
  duration_hours: number;
  duration_days: number;
  labor_hours: number;

  // Costs
  cost_labor: number;
  cost_machine: number;
  cost_rental: number;          // Filled from Schedule!

  // Resources
  crew_size: number;
  resources_required: Record<string, any>; // {"kit_id": "k1", "pump_id": "p1"}

  // Traceability
  source_tag: string;
  norm_used: string;
  assumptions_log: string;
  confidence: number;

  // Dependencies (for scheduling)
  predecessors?: string[];      // Task IDs that must complete before this
}

// ============================================
// SCHEDULE ENTRY
// ============================================

export interface ScheduleEntry {
  task_id: string;
  start_day: number;            // День начала (от старта проекта)
  end_day: number;              // День окончания
  resources_used: Record<string, any>; // {"crew_id": "crew_A", "kit_id": "k1"}
  is_critical?: boolean;        // На критическом пути?
  slack_days?: number;          // Резерв времени (дни)
}

// ============================================
// RESOURCES
// ============================================

export interface Resources {
  // Crews
  crew_rebar_count: number;
  crew_formwork_count: number;
  crew_concreting_count: number;

  // Equipment
  formwork_kits_count: number;
  pumps_count: number;

  // Work regime
  shift_hours: number;
  days_per_month: number;       // 30=continuous, 22=working days
}

// ============================================
// CALENDAR
// ============================================

export interface Calendar {
  start_date?: Date;            // Optional absolute start date
  working_days?: number[];      // [1,2,3,4,5] = Mon-Fri
  holidays?: Date[];            // Non-working days
}

// ============================================
// BOTTLENECK / ISSUE
// ============================================

export interface Bottleneck {
  id: string;
  type: 'POUR_EXCEEDS_SHIFT' | 'FORMWORK_BOTTLENECK' | 'PUMP_UNDERUTILIZED' | 'WAITING_ON_CRITICAL_PATH' | 'CREW_IDLE';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  task_id?: string;             // Optional reference to specific task
  message: string;
  suggestion: string;
  status?: 'open' | 'acknowledged' | 'resolved';
}
