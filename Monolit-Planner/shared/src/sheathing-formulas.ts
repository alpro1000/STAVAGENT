/**
 * Sheathing Formulas - Формулы для расчётов захватки (шахматный метод)
 *
 * Шахматный метод (Checkerboard Method):
 * - Несколько захватки (kits) работают одновременно со смещением по времени
 * - Каждая захватка проходит цикл: сборка → бетонирование → разборка
 * - Смещение между захватками уменьшает общий срок проекта
 */

import {
  SheathingCapture,
  SheathingCalculationResult,
  SheathingProjectConfig
} from './types';

/**
 * Calculate curing days for concrete based on class and ambient temperature
 *
 * Стандартные дни для набора прочности:
 * - C25/30: 3-5 дней (быстро)
 * - C30/37: 5-7 дней (стандарт)
 * - C35/45: 7-10 дней (медленно)
 */
export function getCuringDays(
  concreteClass?: string,
  temperatureCelsius: number = 20
): number {
  if (!concreteClass) {
    return 5; // Default
  }

  const classLower = concreteClass.toLowerCase().trim();

  // Temperature correction: lower temp = more days
  let baseDays = 5;
  let tempFactor = 1.0;

  if (temperatureCelsius < 10) {
    tempFactor = 1.5; // Cold weather
  } else if (temperatureCelsius < 15) {
    tempFactor = 1.3;
  } else if (temperatureCelsius > 25) {
    tempFactor = 0.8; // Hot weather
  }

  if (classLower.includes('c25') || classLower.includes('c30')) {
    baseDays = 3;
  } else if (classLower.includes('c35') || classLower.includes('c40')) {
    baseDays = 7;
  } else if (classLower.includes('c45') || classLower.includes('c50')) {
    baseDays = 10;
  }

  return Math.ceil(baseDays * tempFactor);
}

/**
 * Calculate assembly days for one kit
 *
 * Формула: assembly_days = area_m2 × assembly_norm_ph_m2 / (crew_size × shift_hours)
 *
 * @param area_m2 Площадь опалубки (м²)
 * @param assembly_norm_ph_m2 Норма сборки (человеко-часы на м²)
 * @param crew_size Количество рабочих
 * @param shift_hours Часов в смене (обычно 10)
 */
export function calculateAssemblyDays(
  area_m2: number,
  assembly_norm_ph_m2: number,
  crew_size: number = 4,
  shift_hours: number = 10
): number {
  const totalLaborHours = area_m2 * assembly_norm_ph_m2;
  const hoursPerDay = crew_size * shift_hours;
  return Math.ceil(totalLaborHours / hoursPerDay);
}

/**
 * Calculate disassembly days (usually 50-60% of assembly)
 */
export function calculateDisassemblyDays(
  assemblyDays: number,
  ratio: number = 0.5
): number {
  return Math.ceil(assemblyDays * ratio);
}

/**
 * Calculate single cycle days for one kit
 *
 * Цикл = сборка + бетонирование + разборка
 *
 * @param assemblyDays Дни на сборку
 * @param curingDays Дни набора прочности
 * @param disassemblyDays Дни на разборку
 */
export function calculateSingleCycleDays(
  assemblyDays: number,
  curingDays: number,
  disassemblyDays: number
): number {
  // Note: Assembly and disassembly can overlap with curing
  // Full formula: assembly + curing + disassembly
  // But in practice, disassembly can start after curing reaches acceptable strength (50-70%)
  // For conservative estimate: assembly + curing + disassembly
  return assemblyDays + curingDays + disassemblyDays;
}

/**
 * Calculate shift days between captures (staggered method)
 *
 * В шахматном методе захватки смещены так чтобы:
 * - Когда одна захватка разбирается, следующая собирается
 * - Это минимизирует простои и экономит время
 *
 * Формула для смещения между захватками:
 * shift_days = (assembly_days + curing_days) / num_kits
 *
 * Но не менее assembly_days (чтобы не было конфликтов)
 */
export function calculateShiftDays(
  assemblyDays: number,
  curingDays: number,
  numKits: number
): number {
  if (numKits <= 1) {
    return 0; // No shift for single kit
  }

  // Optimal shift: spread the workflow across all kits
  const optimalShift = (assemblyDays + curingDays) / numKits;

  // But minimum should be assembly_days to avoid conflicts
  return Math.max(
    Math.ceil(optimalShift),
    assemblyDays
  );
}

/**
 * Calculate project duration for sequential method
 *
 * Последовательный метод: захватки работают одна за другой
 * total = (assembly + curing + disassembly) × num_kits
 */
export function calculateSequentialDuration(
  singleCycleDays: number,
  numKits: number
): number {
  return singleCycleDays * numKits;
}

/**
 * Calculate project duration for staggered (checkerboard) method
 *
 * Шахматный метод: захватки работают со смещением
 *
 * Формула:
 * total = (assembly_days × num_kits) + curing_days + disassembly_days
 *
 * Или более точно:
 * total = num_kits × shift_days + (assembly_days + curing_days + disassembly_days) - (num_kits - 1) × shift_days
 * total = assembly_days + num_kits × shift_days + disassembly_days
 *
 * Упрощённо:
 * total ≈ (single_cycle_days / num_kits) + single_cycle_days × (1 - 1/num_kits)
 */
export function calculateStaggredDuration(
  assemblyDays: number,
  curingDays: number,
  disassemblyDays: number,
  numKits: number
): { duration: number; shift: number } {
  if (numKits <= 1) {
    return {
      duration: assemblyDays + curingDays + disassemblyDays,
      shift: 0
    };
  }

  // Calculate optimal shift
  const shiftDays = calculateShiftDays(assemblyDays, curingDays, numKits);

  // Total duration with staggered starts
  // The last kit needs: assembly + curing + disassembly days after it starts
  // But all other kits start earlier
  const duration = (numKits - 1) * shiftDays + assemblyDays + curingDays + disassemblyDays;

  return { duration, shift: shiftDays };
}

/**
 * Calculate labor hours for assembly
 */
export function calculateAssemblyLaborHours(
  area_m2: number,
  assembly_norm_ph_m2: number
): number {
  return area_m2 * assembly_norm_ph_m2;
}

/**
 * Calculate labor hours for disassembly
 */
export function calculateDisassemblyLaborHours(
  assemblyLaborHours: number,
  ratio: number = 0.5
): number {
  return assemblyLaborHours * ratio;
}

/**
 * Calculate total rental cost
 *
 * Cost = daily_rental × num_kits × project_duration_days
 */
export function calculateTotalRentalCost(
  numKits: number,
  dailyRentalPerKit: number,
  projectDurationDays: number
): number {
  return numKits * dailyRentalPerKit * projectDurationDays;
}

/**
 * Main calculation function - combines all formulas
 */
export function calculateSheathing(
  capture: SheathingCapture,
  config: SheathingProjectConfig
): SheathingCalculationResult {
  // Use provided values or defaults from config
  const assemblyNorm = capture.assembly_norm_ph_m2;
  const curingDays = capture.concrete_curing_days;
  const numKits = capture.num_kits;
  const workMethod = capture.work_method;
  const crewSize = capture.crew_size ?? config.crew_size;
  const shiftHours = capture.shift_hours ?? config.shift_hours;

  // Calculate assembly days
  const assemblyDays = calculateAssemblyDays(
    capture.area_m2,
    assemblyNorm,
    crewSize,
    shiftHours
  );

  // Calculate disassembly days
  const disassemblyDays = calculateDisassemblyDays(assemblyDays);

  // Single cycle (one kit goes through full cycle)
  const singleCycleDays = calculateSingleCycleDays(
    assemblyDays,
    curingDays,
    disassemblyDays
  );

  // Sequential vs staggered
  const sequentialDuration = calculateSequentialDuration(singleCycleDays, numKits);

  const staggeredResult = calculateStaggredDuration(
    assemblyDays,
    curingDays,
    disassemblyDays,
    numKits
  );

  // Labor calculations
  const assemblyLaborHours = calculateAssemblyLaborHours(
    capture.area_m2,
    assemblyNorm
  );
  const disassemblyLaborHours = calculateDisassemblyLaborHours(assemblyLaborHours);
  const totalLaborHours = assemblyLaborHours + disassemblyLaborHours;

  // Cost calculations
  const dailyRentalCost = capture.daily_rental_cost_czk ?? 0;
  const actualDuration = workMethod === 'sequential' ? sequentialDuration : staggeredResult.duration;
  const totalRentalCost = dailyRentalCost > 0
    ? calculateTotalRentalCost(numKits, dailyRentalCost, actualDuration)
    : undefined;

  // Time savings
  const timeSavingsDays = Math.max(0, sequentialDuration - staggeredResult.duration);
  const timeSavingsPercent = sequentialDuration > 0
    ? (timeSavingsDays / sequentialDuration) * 100
    : 0;

  // Summary text
  const summary = generateSummary(
    capture.part_name,
    capture.area_m2,
    assemblyDays,
    curingDays,
    disassemblyDays,
    numKits,
    workMethod,
    sequentialDuration,
    staggeredResult.duration,
    timeSavingsDays
  );

  return {
    capture_id: capture.capture_id || '',
    part_name: capture.part_name,
    area_m2: capture.area_m2,
    num_kits: numKits,
    work_method: workMethod,

    // Timeline
    assembly_days: assemblyDays,
    curing_days: curingDays,
    disassembly_days: disassemblyDays,
    single_cycle_days: singleCycleDays,

    // Duration
    sequential_duration_days: sequentialDuration,
    staggered_duration_days: staggeredResult.duration,
    staggered_shift_days: staggeredResult.shift,
    time_savings_days: timeSavingsDays,
    time_savings_percent: Math.round(timeSavingsPercent * 100) / 100,

    // Labor
    total_labor_hours: totalLaborHours,
    daily_crew_hours: crewSize * shiftHours,
    crew_size: crewSize,

    // Costs
    total_rental_cost_czk: totalRentalCost,
    daily_rental_cost_czk: dailyRentalCost,

    // Summary
    summary
  };
}

/**
 * Generate human-readable summary
 */
export function generateSummary(
  partName: string,
  areaMm2: number,
  assemblyDays: number,
  curingDays: number,
  disassemblyDays: number,
  numKits: number,
  workMethod: string,
  sequentialDays: number,
  staggeredDays: number,
  timeSavingsDays: number
): string {
  const method = workMethod === 'staggered' ? 'шахматным методом' : 'последовательно';

  if (workMethod === 'sequential') {
    return (
      `${partName}: ${areaMm2.toFixed(1)} м² опалубки. ` +
      `Цикл: ${assemblyDays}д сборка + ${curingDays}д бетон + ${disassemblyDays}д разборка. ` +
      `${numKits} комплектов, работа последовательно = ${sequentialDays} дней.`
    );
  } else {
    return (
      `${partName}: ${areaMm2.toFixed(1)} м² опалубки. ` +
      `Цикл: ${assemblyDays}д + ${curingDays}д + ${disassemblyDays}д. ` +
      `${numKits} комплектов со смещением = ${staggeredDays} дней (экономия ${timeSavingsDays} дней).`
    );
  }
}

/**
 * Batch calculation for multiple captures
 */
export function calculateAllCaptures(
  captures: SheathingCapture[],
  config: SheathingProjectConfig
): SheathingCalculationResult[] {
  return captures.map(capture => calculateSheathing(capture, config));
}

/**
 * Calculate project-level statistics
 */
export function calculateProjectStats(results: SheathingCalculationResult[]) {
  if (results.length === 0) {
    return {
      total_captures: 0,
      total_area_m2: 0,
      total_labor_hours: 0,
      total_rental_cost_czk: 0,
      max_project_duration_days: 0
    };
  }

  const totalArea = results.reduce((sum, r) => sum + r.area_m2, 0);
  const totalLaborHours = results.reduce((sum, r) => sum + r.total_labor_hours, 0);
  const totalRentalCost = results.reduce((sum, r) => sum + (r.total_rental_cost_czk ?? 0), 0);
  const maxDuration = Math.max(...results.map(r => r.staggered_duration_days));

  return {
    total_captures: results.length,
    total_area_m2: Math.round(totalArea * 100) / 100,
    total_labor_hours: Math.round(totalLaborHours),
    total_rental_cost_czk: Math.round(totalRentalCost),
    max_project_duration_days: maxDuration
  };
}
