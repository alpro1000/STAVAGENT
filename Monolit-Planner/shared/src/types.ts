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
  item_name?: string;             // Detailed item description: "ZÁKLADY ZE ŽELEZOBETONU DO C30/37"
  subtype: Subtype;
  unit: Unit;
  qty: number;                    // Quantity in native unit
  qty_m3_helper?: number;         // Helper field for area/volume reference
  crew_size: number;              // lidi (jedna parta)
  wage_czk_ph: number;            // Kč/hod
  shift_hours: number;            // Hod/den
  days: number;                   // den (koef 1)
  curing_days?: number;           // Dny zrání betonu (only for subtype='beton')

  // OTSKP code (pricing catalog reference)
  otskp_code?: string;            // OTSKP code from catalog (e.g., "113472")

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
  project_name?: string;          // Stavba (Project): "D6 Žalmanov – Knínice, VD – ZDS, bez cen"
  object_name: string;            // Objekt (Bridge): "SO 204 - Most na D6 přes biokoridor v km 3,340"
  element_count: number;
  concrete_m3: number;
  sum_kros_czk: number;
  span_length_m?: number;
  deck_width_m?: number;
  pd_weeks?: number;
  status?: 'active' | 'completed' | 'archived';  // Bridge lifecycle status
  created_at?: string;
  updated_at?: string;

  // Portal Integration (Phase 7)
  portal_project_id?: string;     // UUID from stavagent-portal (links to unified project)
  portal_linked_at?: string;      // ISO timestamp when linked to Portal
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

export interface Snapshot {
  id: string;                       // snapshot_id
  bridge_id: string;
  snapshot_name?: string;           // "základní", "finální"...
  snapshot_hash: string;            // SHA256 hash
  created_at: string;               // ISO timestamp
  created_by?: string;              // Jméno uživatele
  positions_snapshot: Position[];   // Úplná kopie pozic
  header_kpi_snapshot: HeaderKPI;   // Kopie KPI
  description?: string;             // "Finální výpočty"...
  is_locked: boolean;               // true = aktivní zámek
  is_final: boolean;                // true = finální snapshot (při completed)
  parent_snapshot_id?: string;      // Pro sledování verzí
  sum_kros_at_lock: number;         // Suma KROS v okamžiku lock
  delta_to_previous?: number;       // Rozdíl oproti předchozímu
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
  code: string;                   // OTSKP code (e.g., "113472")
  name: string;                   // Full item name
  unit: string;                   // Unit of measurement (M3, M2, KUS, etc.)
  unit_price: number;             // Unit price in CZK
  specification?: string;         // Technical specification
  created_at?: string;            // When added to database
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
  capture_id?: string;              // e.g., "CAP-SO201-01"
  project_id: string;               // Bridge ID (SO201, SO202...)
  part_name: string;                // Part: ZÁKLADY, PILÍŘE, MOSTOVKA...

  // Dimensions (размеры)
  length_m: number;                 // Длина (L) в метрах
  width_m: number;                  // Ширина (W) в метрах
  height_m?: number;                // Высота (H) в метрах (опционально)
  area_m2: number;                  // Опалубочная площадь (length × width)
  volume_m3?: number;               // Объём бетона (area × height / 1000)

  // Work characteristics
  assembly_norm_ph_m2: number;       // Норма сборки опалубки (человеко-часы на м²)
  concrete_class?: string;           // C25/30, C30/37, C35/45...
  concrete_curing_days: number;      // Дни набора прочности (3-7 дней в зависимости от класса и температуры)

  // Sheathing kit/rental info
  num_kits: number;                 // Количество комплектов опалубки (обычно 2-4 для шахматного метода)
  kit_type?: string;                // DOKA, PERI, местный... (опционально)
  daily_rental_cost_czk?: number;   // Суточная стоимость аренды за 1 комплект (опционально)

  // Work method
  work_method: 'sequential' | 'staggered'; // 'sequential' = последовательно, 'staggered' = шахматный

  // Calculated fields
  single_cycle_days?: number;       // Дни на одну захватку (сборка + бетонирование + разборка)
  project_duration_days?: number;   // Общий срок проекта (все захватки)
  crew_size?: number;               // Количество рабочих в смене
  shift_hours?: number;             // Часов в смене (обычно 10)
  days_per_month?: number;          // Рабочих дней в месяце (22 или 30)

  // Cost estimates
  assembly_labor_hours?: number;    // Человеко-часы на сборку (area_m2 × assembly_norm_ph_m2)
  disassembly_labor_hours?: number; // Человеко-часы на разборку (обычно 0.5 × сборки)
  total_rental_cost_czk?: number;   // Общая стоимость аренды комплектов

  // Metadata
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

  // Input summary
  area_m2: number;
  num_kits: number;
  work_method: 'sequential' | 'staggered';

  // Timeline calculations
  assembly_days: number;            // Дни на сборку одного комплекта
  curing_days: number;              // Дни набора прочности бетона
  disassembly_days: number;         // Дни на разборку
  single_cycle_days: number;        // Полный цикл для одного комплекта

  // Project duration
  sequential_duration_days: number;        // Если работать последовательно
  staggered_duration_days: number;        // Если работать шахматным методом
  staggered_shift_days: number;           // Дни смещения между захватками
  time_savings_days?: number;             // Экономия времени vs последовательный
  time_savings_percent?: number;          // % экономии

  // Labor
  total_labor_hours: number;        // Сборка + разборка
  daily_crew_hours: number;         // Часов в день на одного рабочего
  crew_size: number;

  // Costs (if rental data available)
  total_rental_cost_czk?: number;
  daily_rental_cost_czk?: number;

  // Summary for reports
  summary: string;                  // Human-readable summary
}

/**
 * SheathingProjectConfig - Конфигурация проекта для расчётов захватки
 */
export interface SheathingProjectConfig {
  project_id: string;

  // Default values
  default_assembly_norm_ph_m2: number;    // По умолчанию 0.5-1.5 ч/м²
  default_concrete_curing_days: number;   // По умолчанию 3-7 дней
  default_num_kits: number;               // По умолчанию 2-3
  default_work_method: 'sequential' | 'staggered';

  // Concrete characteristics
  concrete_class_default?: string;  // C30/37

  // Rental info
  daily_rental_cost_per_kit_czk?: number; // Суточная аренда

  // Labor defaults
  crew_size: number;               // Стандартный размер бригады
  shift_hours: number;             // Часов в смене (обычно 10)
  days_per_month: 22 | 30;        // Рабочих дней в месяце

  created_at?: string;
  updated_at?: string;
}

/**
 * FormworkCalculatorRow - One row in the Formwork Calculator
 * Represents a formwork set for a specific construction element
 */
export interface FormworkCalculatorRow {
  id: string;                       // Unique ID (uuid)
  bridge_id: string;                // Project reference
  construction_name: string;        // e.g., "Základ OP (sada: 1x základ / dilatace / LM)"
  total_area_m2: number;            // Celkem [m²]
  set_area_m2: number;              // Sada [m²] - area of one formwork set
  num_tacts: number;                // Množství taktů [kus] (editable, default = ceil(total/set))
  num_sets: number;                 // Množství sad [kus] (usually 1)

  // Time
  assembly_days_per_tact: number;   // Dny montáže na takt
  disassembly_days_per_tact: number; // Dny demontáže na takt
  days_per_tact: number;            // počet dní na takt (zřízení+odstranění)
  formwork_term_days: number;       // termín bednění [den] (= taktů × dní_na_takt)

  // Formwork system
  system_name: string;              // Bednící systém (Frami Xlife, TRIO, Framax...)
  system_height: string;            // Rozměry / Výška (h= 0.9 m, h= 1.50 m...)

  // Rental pricing
  rental_czk_per_m2_month: number;  // Měsíční nájem [Kč/m²]
  monthly_rental_per_set: number;   // Měsíční nájem [sada] = set_m2 × Kč/m²
  final_rental_czk: number;         // Konečný nájem = monthly × (termín / 30)

  // KROS
  kros_code?: string;               // Kód položky - KROS
  kros_description?: string;        // Auto-generated KROS description

  created_at?: string;
  updated_at?: string;
}

/**
 * FormworkSystem - Pre-defined formwork system from catalog
 */
export interface FormworkSystem {
  name: string;                     // System name (e.g., "Frami Xlife")
  manufacturer: string;             // DOKA, PERI, etc.
  heights: string[];                // Available heights
  rental_czk_m2_month: number;      // Typical rental price per m² per month
  assembly_h_m2: number;            // Assembly labor norm (hours/m²)
  disassembly_ratio: number;        // Disassembly as fraction of assembly (0.3-0.5)
  description?: string;             // Notes
}
