/**
 * Monolit-Planner Integration
 * Implements KROS formulas and duration estimation
 * Ported from Monolit-Planner/shared/src/formulas.ts
 *
 * Key formulas:
 * - unit_cost_on_m3 = cost_czk / concrete_m3
 * - kros_unit_czk = Math.ceil(unit_cost_on_m3 / 50) * 50
 * - kros_total_czk = kros_unit_czk * concrete_m3
 * - estimated_months = sum_kros_total_czk / (crew * wage * shift_hours * days_per_month)
 */

import { logger } from '../../utils/logger.js';

// ============================================================================
// CONSTANTS (from Monolit-Planner)
// ============================================================================

export const MONOLIT_DEFAULTS = {
  // Work subtypes
  WORK_TYPES: {
    beton: { name: 'Beton', unit: 'm3', description: 'Betonové práce' },
    bedneni: { name: 'Bednění', unit: 'm2', description: 'Bednicí práce' },
    vyztuz: { name: 'Výztuž', unit: 'kg', description: 'Armovací práce' },
    jine: { name: 'Jiné', unit: 'ks', description: 'Ostatní práce' }
  },

  // Default values for calculations
  DAYS_PER_MONTH: 22,
  DEFAULT_SHIFT_HOURS: 8,
  DEFAULT_CREW_SIZE: 4,
  DEFAULT_WAGE_CZK_PH: 350,  // CZK/hour

  // KROS rounding step
  KROS_ROUNDING_STEP: 50,

  // Concrete density for ton calculations
  CONCRETE_DENSITY_T_PER_M3: 2.4
};

/**
 * Typical production rates (m3/shift) by work type
 * Based on Czech norms (normování práce)
 */
export const PRODUCTION_RATES = {
  beton: {
    zakladova_patka: { rate: 8, unit: 'm3/shift', crew: 4, description: 'Betonáž patek' },
    zakladovy_pas: { rate: 10, unit: 'm3/shift', crew: 4, description: 'Betonáž pásů' },
    zakladova_deska: { rate: 15, unit: 'm3/shift', crew: 5, description: 'Betonáž desek' },
    stena: { rate: 6, unit: 'm3/shift', crew: 4, description: 'Betonáž stěn' },
    sloup: { rate: 4, unit: 'm3/shift', crew: 3, description: 'Betonáž sloupů' },
    stropni_deska: { rate: 12, unit: 'm3/shift', crew: 5, description: 'Betonáž stropů' },
    prusek: { rate: 5, unit: 'm3/shift', crew: 4, description: 'Betonáž průvlaků' }
  },
  bedneni: {
    zakladova_patka: { rate: 12, unit: 'm2/shift', crew: 2, description: 'Bednění patek' },
    zakladovy_pas: { rate: 15, unit: 'm2/shift', crew: 2, description: 'Bednění pásů' },
    stena: { rate: 20, unit: 'm2/shift', crew: 3, description: 'Systémové bednění stěn' },
    sloup: { rate: 8, unit: 'm2/shift', crew: 2, description: 'Bednění sloupů' },
    stropni_deska: { rate: 25, unit: 'm2/shift', crew: 3, description: 'Stropní bednění' },
    prusek: { rate: 10, unit: 'm2/shift', crew: 2, description: 'Bednění průvlaků' }
  },
  vyztuz: {
    zakladova_patka: { rate: 600, unit: 'kg/shift', crew: 3, description: 'Armování patek' },
    zakladovy_pas: { rate: 500, unit: 'kg/shift', crew: 3, description: 'Armování pásů' },
    stena: { rate: 400, unit: 'kg/shift', crew: 3, description: 'Armování stěn' },
    sloup: { rate: 350, unit: 'kg/shift', crew: 2, description: 'Armování sloupů' },
    stropni_deska: { rate: 600, unit: 'kg/shift', crew: 3, description: 'Armování stropů' },
    prusek: { rate: 400, unit: 'kg/shift', crew: 2, description: 'Armování průvlaků' }
  }
};

// ============================================================================
// KROS FORMULAS
// ============================================================================

/**
 * Calculate unit cost per m3 of concrete
 *
 * @param {number} costCzk - Total cost in CZK
 * @param {number} concreteM3 - Concrete volume in m3
 * @returns {number} Unit cost CZK/m3
 */
export function calcUnitCostOnM3(costCzk, concreteM3) {
  if (!concreteM3 || concreteM3 <= 0) return 0;
  return costCzk / concreteM3;
}

/**
 * Calculate KROS unit price (rounded up to nearest KROS_ROUNDING_STEP)
 *
 * @param {number} unitCostOnM3 - Unit cost CZK/m3
 * @returns {number} KROS-rounded unit price
 */
export function calcKrosUnitCzk(unitCostOnM3) {
  if (!unitCostOnM3 || unitCostOnM3 <= 0) return 0;
  return Math.ceil(unitCostOnM3 / MONOLIT_DEFAULTS.KROS_ROUNDING_STEP) * MONOLIT_DEFAULTS.KROS_ROUNDING_STEP;
}

/**
 * Calculate KROS total cost
 *
 * @param {number} krosUnitCzk - KROS unit price
 * @param {number} concreteM3 - Concrete volume
 * @returns {number} Total KROS cost
 */
export function calcKrosTotalCzk(krosUnitCzk, concreteM3) {
  return krosUnitCzk * concreteM3;
}

/**
 * Calculate labor hours
 *
 * @param {number} crewSize - Number of workers
 * @param {number} shiftHours - Hours per shift
 * @param {number} days - Number of working days
 * @returns {number} Total labor hours
 */
export function calcLaborHours(crewSize, shiftHours, days) {
  return crewSize * shiftHours * days;
}

/**
 * Calculate cost from labor
 *
 * @param {number} laborHours - Total labor hours
 * @param {number} wageCzkPh - Wage in CZK per hour
 * @returns {number} Total cost CZK
 */
export function calcCostCzk(laborHours, wageCzkPh) {
  return laborHours * wageCzkPh;
}

/**
 * Estimate project duration in months
 *
 * @param {number} sumKrosTotalCzk - Total KROS cost
 * @param {number} avgCrew - Average crew size
 * @param {number} avgWage - Average wage CZK/h
 * @param {number} avgShift - Average shift hours
 * @returns {Object} Duration estimates
 */
export function estimateDuration(sumKrosTotalCzk, avgCrew, avgWage, avgShift) {
  const crew = avgCrew || MONOLIT_DEFAULTS.DEFAULT_CREW_SIZE;
  const wage = avgWage || MONOLIT_DEFAULTS.DEFAULT_WAGE_CZK_PH;
  const shift = avgShift || MONOLIT_DEFAULTS.DEFAULT_SHIFT_HOURS;
  const daysPerMonth = MONOLIT_DEFAULTS.DAYS_PER_MONTH;

  const monthlyCapacity = crew * wage * shift * daysPerMonth;
  const estimatedMonths = monthlyCapacity > 0 ? sumKrosTotalCzk / monthlyCapacity : 0;
  const estimatedWeeks = (estimatedMonths * daysPerMonth) / 7;

  return {
    months: Math.round(estimatedMonths * 10) / 10,
    weeks: Math.round(estimatedWeeks * 10) / 10,
    days: Math.round(estimatedMonths * daysPerMonth),
    assumptions: {
      crewSize: crew,
      wageCzkPh: wage,
      shiftHours: shift,
      daysPerMonth
    }
  };
}

// ============================================================================
// FULL POSITION CALCULATION
// ============================================================================

/**
 * Calculate full position metrics (Monolit-Planner style)
 *
 * @param {Object} position - Position data
 * @param {string} position.workType - 'beton', 'bedneni', 'vyztuz', 'jine'
 * @param {number} position.quantity - Quantity in native units
 * @param {number} position.concreteM3 - Reference concrete volume
 * @param {number} position.crewSize - Crew size
 * @param {number} position.shiftHours - Hours per shift
 * @param {number} position.days - Working days
 * @param {number} position.wageCzkPh - Wage CZK/hour
 * @returns {Object} Full calculation result
 */
export function calculatePosition(position) {
  const {
    workType = 'beton',
    quantity = 0,
    concreteM3 = 0,
    crewSize = MONOLIT_DEFAULTS.DEFAULT_CREW_SIZE,
    shiftHours = MONOLIT_DEFAULTS.DEFAULT_SHIFT_HOURS,
    days = 0,
    wageCzkPh = MONOLIT_DEFAULTS.DEFAULT_WAGE_CZK_PH
  } = position;

  const laborHours = calcLaborHours(crewSize, shiftHours, days);
  const costCzk = calcCostCzk(laborHours, wageCzkPh);
  const unitCostNative = quantity > 0 ? costCzk / quantity : 0;
  const unitCostOnM3 = calcUnitCostOnM3(costCzk, concreteM3);
  const krosUnitCzk = calcKrosUnitCzk(unitCostOnM3);
  const krosTotalCzk = calcKrosTotalCzk(krosUnitCzk, concreteM3);

  return {
    input: { workType, quantity, concreteM3, crewSize, shiftHours, days, wageCzkPh },
    result: {
      laborHours,
      costCzk: Math.round(costCzk),
      unitCostNative: Math.round(unitCostNative),
      unitCostOnM3: Math.round(unitCostOnM3),
      krosUnitCzk,
      krosTotalCzk: Math.round(krosTotalCzk)
    },
    unit: MONOLIT_DEFAULTS.WORK_TYPES[workType]?.unit || 'ks'
  };
}

/**
 * Estimate days needed for a given volume of work
 *
 * @param {string} workType - 'beton', 'bedneni', 'vyztuz'
 * @param {string} structureType - Structure type key
 * @param {number} quantity - Volume/area/weight of work
 * @returns {Object} Day estimation
 */
export function estimateDays(workType, structureType, quantity) {
  const rates = PRODUCTION_RATES[workType];
  if (!rates) {
    return {
      success: false,
      error: `Unknown work type: ${workType}`,
      availableTypes: Object.keys(PRODUCTION_RATES)
    };
  }

  const rate = rates[structureType];
  if (!rate) {
    // Fallback: use average of all rates for this work type
    const allRates = Object.values(rates);
    const avgRate = allRates.reduce((sum, r) => sum + r.rate, 0) / allRates.length;
    const days = Math.ceil(quantity / avgRate);

    return {
      success: true,
      days,
      rate: avgRate,
      crew: MONOLIT_DEFAULTS.DEFAULT_CREW_SIZE,
      method: 'average',
      note: `Průměrný výkon pro ${workType}`
    };
  }

  const days = Math.ceil(quantity / rate.rate);

  return {
    success: true,
    days,
    rate: rate.rate,
    crew: rate.crew,
    unit: rate.unit,
    description: rate.description,
    method: 'specific'
  };
}

/**
 * Calculate complete project summary (aggregate)
 *
 * @param {Array} positions - Array of calculated positions
 * @returns {Object} Project summary with KPI
 */
export function calculateProjectSummary(positions) {
  if (!positions || positions.length === 0) {
    return { success: false, error: 'No positions provided' };
  }

  let sumConcreteM3 = 0;
  let sumKrosTotalCzk = 0;
  let sumLaborHours = 0;
  let totalCrew = 0;
  let totalWage = 0;
  let totalShift = 0;
  let posCount = 0;

  for (const pos of positions) {
    const result = pos.result || pos;
    sumConcreteM3 += pos.input?.concreteM3 || 0;
    sumKrosTotalCzk += result.krosTotalCzk || 0;
    sumLaborHours += result.laborHours || 0;

    if (pos.input?.crewSize) {
      totalCrew += pos.input.crewSize;
      totalWage += pos.input.wageCzkPh || MONOLIT_DEFAULTS.DEFAULT_WAGE_CZK_PH;
      totalShift += pos.input.shiftHours || MONOLIT_DEFAULTS.DEFAULT_SHIFT_HOURS;
      posCount++;
    }
  }

  const avgCrew = posCount > 0 ? totalCrew / posCount : MONOLIT_DEFAULTS.DEFAULT_CREW_SIZE;
  const avgWage = posCount > 0 ? totalWage / posCount : MONOLIT_DEFAULTS.DEFAULT_WAGE_CZK_PH;
  const avgShift = posCount > 0 ? totalShift / posCount : MONOLIT_DEFAULTS.DEFAULT_SHIFT_HOURS;

  const duration = estimateDuration(sumKrosTotalCzk, avgCrew, avgWage, avgShift);

  const projectUnitCostM3 = sumConcreteM3 > 0
    ? Math.round(sumKrosTotalCzk / sumConcreteM3)
    : 0;
  const projectUnitCostTon = sumConcreteM3 > 0
    ? Math.round(sumKrosTotalCzk / (sumConcreteM3 * MONOLIT_DEFAULTS.CONCRETE_DENSITY_T_PER_M3))
    : 0;

  return {
    success: true,
    summary: {
      positionCount: positions.length,
      sumConcreteM3: Math.round(sumConcreteM3 * 100) / 100,
      sumKrosTotalCzk: Math.round(sumKrosTotalCzk),
      sumLaborHours: Math.round(sumLaborHours),
      projectUnitCostCzkPerM3: projectUnitCostM3,
      projectUnitCostCzkPerTon: projectUnitCostTon,
      concreteTons: Math.round(sumConcreteM3 * MONOLIT_DEFAULTS.CONCRETE_DENSITY_T_PER_M3 * 10) / 10
    },
    duration,
    averages: {
      crewSize: Math.round(avgCrew * 10) / 10,
      wageCzkPh: Math.round(avgWage),
      shiftHours: Math.round(avgShift * 10) / 10
    }
  };
}
