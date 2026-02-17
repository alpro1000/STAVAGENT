/**
 * Monolit Planner - Calculation Formulas
 * Core business logic for position calculations
 */

import { Position, HeaderKPI, FormworkCalculatorRow } from './types';

/**
 * Calculate labor hours for a position
 */
export function calculateLaborHours(
  crew_size: number,
  shift_hours: number,
  days: number
): number {
  return crew_size * shift_hours * days;
}

/**
 * Calculate total cost in CZK
 */
export function calculateCostCZK(
  labor_hours: number,
  wage_czk_ph: number
): number {
  return labor_hours * wage_czk_ph;
}

/**
 * Calculate unit cost in native unit (CZK/MJ)
 */
export function calculateUnitCostNative(
  cost_czk: number,
  qty: number
): number {
  if (qty === 0) return 0;
  return cost_czk / qty;
}

/**
 * Calculate unit cost per m³ of concrete (KEY METRIC!)
 * This converts all subtypes to a common denominator: CZK/m³ of concrete
 */
export function calculateUnitCostOnM3(
  cost_czk: number,
  concrete_m3: number
): number {
  if (concrete_m3 === 0) return 0;
  return cost_czk / concrete_m3;
}

/**
 * Calculate KROS unit cost with rounding up to nearest 50 CZK step
 */
export function calculateKrosUnitCZK(
  unit_cost_on_m3: number,
  rounding_step: number = 50
): number {
  return Math.ceil(unit_cost_on_m3 / rounding_step) * rounding_step;
}

/**
 * Calculate KROS total cost
 */
export function calculateKrosTotalCZK(
  kros_unit_czk: number,
  concrete_m3: number
): number {
  return kros_unit_czk * concrete_m3;
}

/**
 * Find concrete volume for a part (from beton subtype position)
 */
export function findConcreteVolumeForPart(
  positions: Position[],
  bridge_id: string,
  part_name: string
): number | null {
  const betonPosition = positions.find(
    p => p.bridge_id === bridge_id &&
         p.part_name === part_name &&
         p.subtype === 'beton'
  );

  return betonPosition?.qty || null;
}

/**
 * Calculate all derived fields for a position
 */
export function calculatePositionFields(
  position: Position,
  allPositions: Position[],
  config: { rounding_step_kros?: number } = {}
): Position {
  const { rounding_step_kros = 50 } = config;

  // Calculate labor hours
  const labor_hours = calculateLaborHours(
    position.crew_size,
    position.shift_hours,
    position.days
  );

  // Calculate cost
  const cost_czk = calculateCostCZK(labor_hours, position.wage_czk_ph);

  // Calculate native unit cost
  const unit_cost_native = calculateUnitCostNative(cost_czk, position.qty);

  // Determine concrete volume
  let concrete_m3: number;
  if (position.subtype === 'beton') {
    concrete_m3 = position.qty; // For beton, qty IS the concrete volume
  } else {
    // For other subtypes, find the beton position of the same part
    const foundVolume = findConcreteVolumeForPart(
      allPositions,
      position.bridge_id,
      position.part_name
    );
    concrete_m3 = foundVolume || 0;
  }

  // Calculate unit cost per m³ (KEY METRIC!)
  const unit_cost_on_m3 = calculateUnitCostOnM3(cost_czk, concrete_m3);

  // Calculate KROS values
  const kros_unit_czk = calculateKrosUnitCZK(unit_cost_on_m3, rounding_step_kros);
  const kros_total_czk = calculateKrosTotalCZK(kros_unit_czk, concrete_m3);

  // Detect RFI
  let has_rfi = false;
  let rfi_message = '';

  // Check if beton quantity is missing (for both beton and other subtypes)
  if (concrete_m3 === 0) {
    has_rfi = true;
    if (position.subtype === 'beton') {
      rfi_message = `⚠️ Chybí objem betonu! Zadejte "Objem betonu celkem" v PartHeader výše.`;
    } else {
      rfi_message = `Není najdena řádka beton pro část "${position.part_name}". Zadejte objem betonu (m³) v PartHeader.`;
    }
  }

  if (position.days === 0) {
    has_rfi = true;
    rfi_message += (rfi_message ? ' | ' : '') +
      'Chybí počet dní (den=0). Náklady nejsou zahrnuty do KPI.';
  }

  return {
    ...position,
    labor_hours,
    cost_czk,
    unit_cost_native,
    concrete_m3,
    unit_cost_on_m3,
    kros_unit_czk,
    kros_total_czk,
    has_rfi,
    rfi_message: rfi_message || undefined
  };
}

/**
 * Calculate weighted average of a field across positions
 */
export function calculateWeightedAverage(
  positions: Position[],
  field: keyof Position,
  weightField: 'concrete_m3' = 'concrete_m3'
): number {
  const validPositions = positions.filter(p => {
    const weight = p[weightField];
    const value = p[field];

    // Type safety: ensure both weight and value are numbers
    return (
      typeof weight === 'number' &&
      typeof value === 'number' &&
      weight !== 0 &&
      !isNaN(weight) &&
      !isNaN(value)
    );
  });

  if (validPositions.length === 0) return 0;

  const totalWeight = validPositions.reduce((sum, p) => sum + (p[weightField] as number), 0);
  const weightedSum = validPositions.reduce((sum, p) =>
    sum + ((p[field] as number) * (p[weightField] as number)),
    0
  );

  return weightedSum / totalWeight;
}

/**
 * ⭐ Calculate duration in months
 * Formula: sum_kros_total_czk / (avg_crew × avg_wage × avg_shift × days_per_month)
 */
export function calculateEstimatedMonths(
  sum_kros_total_czk: number,
  avg_crew_size: number,
  avg_wage_czk_ph: number,
  avg_shift_hours: number,
  days_per_month: number
): number {
  const cost_per_day = avg_crew_size * avg_wage_czk_ph * avg_shift_hours;

  // Prevent division by zero
  if (cost_per_day === 0 || days_per_month === 0) return 0;

  const total_days = sum_kros_total_czk / cost_per_day;
  return total_days / days_per_month;
}

/**
 * ⭐ Calculate duration in weeks
 * Formula: estimated_months × days_per_month / 7
 */
export function calculateEstimatedWeeks(
  estimated_months: number,
  days_per_month: number
): number {
  return (estimated_months * days_per_month) / 7;
}

/**
 * Calculate complete Header KPI for a bridge
 */
export function calculateHeaderKPI(
  positions: Position[],
  bridgeParams: {
    span_length_m?: number;
    deck_width_m?: number;
    pd_weeks?: number;
    days_per_month_mode?: 30 | 22;
  },
  config: {
    rho_t_per_m3?: number;
  } = {}
): HeaderKPI {
  const { rho_t_per_m3 = 2.4 } = config;
  const days_per_month_mode = bridgeParams.days_per_month_mode || 30;

  // Calculate sums
  const betonPositions = positions.filter(p => p.subtype === 'beton');
  const sum_concrete_m3 = betonPositions.reduce((sum, p) => sum + (p.concrete_m3 || 0), 0);
  const sum_kros_total_czk = positions.reduce((sum, p) => sum + (p.kros_total_czk || 0), 0);

  // Calculate unit costs
  const project_unit_cost_czk_per_m3 = sum_concrete_m3 > 0
    ? sum_kros_total_czk / sum_concrete_m3
    : 0;
  const project_unit_cost_czk_per_t = project_unit_cost_czk_per_m3 / rho_t_per_m3;

  // Calculate weighted averages
  const avg_crew_size = calculateWeightedAverage(positions, 'crew_size');
  const avg_wage_czk_ph = calculateWeightedAverage(positions, 'wage_czk_ph');
  const avg_shift_hours = calculateWeightedAverage(positions, 'shift_hours');

  // ⭐ Calculate duration
  const estimated_months = calculateEstimatedMonths(
    sum_kros_total_czk,
    avg_crew_size,
    avg_wage_czk_ph,
    avg_shift_hours,
    days_per_month_mode
  );

  const estimated_weeks = calculateEstimatedWeeks(
    estimated_months,
    days_per_month_mode
  );

  return {
    span_length_m: bridgeParams.span_length_m,
    deck_width_m: bridgeParams.deck_width_m,
    pd_weeks: bridgeParams.pd_weeks,
    days_per_month_mode,
    sum_concrete_m3,
    sum_kros_total_czk,
    project_unit_cost_czk_per_m3,
    project_unit_cost_czk_per_t,
    estimated_months,
    estimated_weeks,
    avg_crew_size,
    avg_wage_czk_ph,
    avg_shift_hours,
    days_per_month: days_per_month_mode,
    rho_t_per_m3
  };
}

// ============================================================
// FORMWORK CALCULATOR FORMULAS
// ============================================================

/**
 * Calculate number of tacts (cycles) for formwork
 * Default: ceil(total_area / set_area), but user can override
 */
export function calculateFormworkTacts(
  total_area_m2: number,
  set_area_m2: number
): number {
  if (set_area_m2 <= 0) return 1;
  return Math.ceil(total_area_m2 / set_area_m2);
}

/**
 * Calculate formwork term in days (pure formwork work only)
 * termín = taktů × dní_na_takt
 */
export function calculateFormworkTerm(
  num_tacts: number,
  days_per_tact: number
): number {
  return num_tacts * days_per_tact;
}

/**
 * Calculate monthly rental cost per set
 * měsíční_nájem_sada = sada_m² × cena_Kč/m²
 */
export function calculateMonthlyRentalPerSet(
  set_area_m2: number,
  rental_czk_per_m2_month: number
): number {
  return set_area_m2 * rental_czk_per_m2_month;
}

/**
 * Calculate final rental cost for the usage period
 * konečný_nájem = měsíční_nájem_sada × (termín_dní / 30)
 */
export function calculateFinalRentalCost(
  monthly_rental_per_set: number,
  term_days: number
): number {
  if (term_days <= 0) return 0;
  return monthly_rental_per_set * (term_days / 30);
}

/**
 * Calculate total element duration (all work types + curing)
 * Used to determine total formwork occupancy for rental calculation
 *
 * Celk. doba = Σ dny(bednění) + Σ dny(výztuž) + Σ dny(beton) + max(curing_days)
 */
export function calculateElementTotalDays(
  partPositions: Position[]
): number {
  let bedneniDays = 0;
  let vyztuzDays = 0;
  let betonDays = 0;
  let maxCuringDays = 0;
  let otherDays = 0;

  for (const pos of partPositions) {
    const days = pos.days || 0;
    const subtype = pos.subtype;

    if (subtype === 'bednění' || subtype?.startsWith('oboustranné')) {
      bedneniDays += days;
    } else if (subtype === 'výztuž') {
      vyztuzDays += days;
    } else if (subtype === 'beton') {
      betonDays += days;
      const curing = (pos as any).curing_days || 0;
      if (curing > maxCuringDays) maxCuringDays = curing;
    } else if (subtype === 'jiné') {
      // "jiné" with rental metadata don't count towards element time
      // they are a result of the calculator, not a work activity
      const meta = (pos as any).metadata;
      const isFormworkRental = typeof meta === 'string'
        ? meta.includes('formwork_rental')
        : (meta && typeof meta === 'object' && meta.type === 'formwork_rental');
      if (!isFormworkRental) {
        otherDays += days;
      }
    }
  }

  return bedneniDays + vyztuzDays + betonDays + maxCuringDays + otherDays;
}

/**
 * Generate KROS description for formwork rental position
 */
export function generateFormworkKrosDescription(
  row: Pick<FormworkCalculatorRow, 'construction_name' | 'system_name' | 'system_height' | 'rental_czk_per_m2_month' | 'set_area_m2' | 'monthly_rental_per_set'>
): string {
  const price = row.rental_czk_per_m2_month.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setArea = row.set_area_m2.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthlyRental = row.monthly_rental_per_set.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `Bednění - ${row.construction_name} (${row.system_name} ${row.system_height}; ${price} Kč/m2) sada - ${setArea} m2 => ${monthlyRental} Kč/sada/měsíc`;
}
