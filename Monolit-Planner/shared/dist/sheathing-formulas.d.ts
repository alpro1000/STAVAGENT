/**
 * Sheathing Formulas - Формулы для расчётов захватки (шахматный метод)
 *
 * Шахматный метод (Checkerboard Method):
 * - Несколько захватки (kits) работают одновременно со смещением по времени
 * - Каждая захватка проходит цикл: сборка → бетонирование → разборка
 * - Смещение между захватками уменьшает общий срок проекта
 */
import { SheathingCapture, SheathingCalculationResult, SheathingProjectConfig } from './types';
/**
 * Calculate curing days for concrete based on class and ambient temperature.
 *
 * Delegates to calculateCuring() from maturity.ts (ČSN EN 13670 Table NA.2).
 * This is a backward-compatible wrapper — new code should use calculateCuring() directly.
 */
export declare function getCuringDays(concreteClass?: string, temperatureCelsius?: number): number;
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
export declare function calculateAssemblyDays(area_m2: number, assembly_norm_ph_m2: number, crew_size?: number, shift_hours?: number): number;
/**
 * Calculate disassembly days (usually 50-60% of assembly)
 */
export declare function calculateDisassemblyDays(assemblyDays: number, ratio?: number): number;
/**
 * Calculate single cycle days for one kit
 *
 * Цикл = сборка + бетонирование + разборка
 *
 * @param assemblyDays Дни на сборку
 * @param curingDays Дни набора прочности
 * @param disassemblyDays Дни на разборку
 */
export declare function calculateSingleCycleDays(assemblyDays: number, curingDays: number, disassemblyDays: number): number;
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
export declare function calculateShiftDays(assemblyDays: number, curingDays: number, numKits: number): number;
/**
 * Calculate project duration for sequential method
 *
 * Последовательный метод: захватки работают одна за другой
 * total = (assembly + curing + disassembly) × num_kits
 */
export declare function calculateSequentialDuration(singleCycleDays: number, numKits: number): number;
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
export declare function calculateStaggredDuration(assemblyDays: number, curingDays: number, disassemblyDays: number, numKits: number): {
    duration: number;
    shift: number;
};
/**
 * Calculate labor hours for assembly
 */
export declare function calculateAssemblyLaborHours(area_m2: number, assembly_norm_ph_m2: number): number;
/**
 * Calculate labor hours for disassembly
 */
export declare function calculateDisassemblyLaborHours(assemblyLaborHours: number, ratio?: number): number;
/**
 * Calculate total rental cost
 *
 * Cost = daily_rental × num_kits × project_duration_days
 */
export declare function calculateTotalRentalCost(numKits: number, dailyRentalPerKit: number, projectDurationDays: number): number;
/**
 * Main calculation function - combines all formulas
 */
export declare function calculateSheathing(capture: SheathingCapture, config: SheathingProjectConfig): SheathingCalculationResult;
/**
 * Generate human-readable summary
 */
export declare function generateSummary(partName: string, areaMm2: number, assemblyDays: number, curingDays: number, disassemblyDays: number, numKits: number, workMethod: string, sequentialDays: number, staggeredDays: number, timeSavingsDays: number): string;
/**
 * Batch calculation for multiple captures
 */
export declare function calculateAllCaptures(captures: SheathingCapture[], config: SheathingProjectConfig): SheathingCalculationResult[];
/**
 * Calculate project-level statistics
 */
export declare function calculateProjectStats(results: SheathingCalculationResult[]): {
    total_captures: number;
    total_area_m2: number;
    total_labor_hours: number;
    total_rental_cost_czk: number;
    max_project_duration_days: number;
};
