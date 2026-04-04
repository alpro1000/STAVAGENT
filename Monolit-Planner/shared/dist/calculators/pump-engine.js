/**
 * Shared Pump Engine v1.0
 *
 * Unified pump cost calculator for both Registry and Planner.
 * Data-agnostic: receives supplier/pump data as parameters.
 *
 * Supports 3 Czech supplier billing models:
 *   1. hourly         — CZK/h (e.g., Beton Union)
 *   2. hourly_plus_m3 — CZK/h + CZK/m³ (e.g., Berger)
 *   3. per_15min      — CZK/15min (e.g., Frischbeton)
 *
 * Surcharge types:
 *   - percentage   — % of base operation cost
 *   - per_hour     — CZK/h
 *   - flat         — one-time CZK fee
 *
 * Calendar integration:
 *   Uses Calendar Engine for accurate Czech holiday detection
 *   (instead of hardcoded MM-DD strings with wrong Easter dates).
 *
 * Integration:
 *   - Planner: pour-task-engine calls quickPumpEstimate() for scheduling
 *   - Registry: full compareSuppliers() for cost comparison table
 */
import { getCzechHolidays } from './calendar-engine.js';
/**
 * Determine day type using Calendar Engine (accurate Easter calculation).
 */
export function getDayType(date) {
    const year = date.getFullYear();
    const holidays = getCzechHolidays(year);
    const isHoliday = holidays.some(h => h.date.getFullYear() === date.getFullYear() &&
        h.date.getMonth() === date.getMonth() &&
        h.date.getDate() === date.getDate());
    if (isHoliday)
        return 'holiday';
    const dow = date.getDay();
    if (dow === 0)
        return 'sunday';
    if (dow === 6)
        return 'saturday';
    return 'workday';
}
// ─── Cost calculations ──────────────────────────────────────────────────────
/**
 * Calculate arrival (mobilization) cost.
 */
export function calculateArrival(pump, distance_km) {
    let cost = 0;
    if (pump.arrival_fixed)
        cost += pump.arrival_fixed;
    if (pump.arrival_per_km)
        cost += distance_km * pump.arrival_per_km * 2; // round trip
    return Math.round(cost);
}
/**
 * Calculate operation cost based on billing model.
 */
export function calculateOperation(billing_model, pump, hours, volume_m3) {
    switch (billing_model) {
        case 'hourly':
            return (pump.operation_per_h ?? 0) * hours;
        case 'hourly_plus_m3':
            return (pump.operation_per_h ?? 0) * hours + (pump.volume_per_m3 ?? 0) * volume_m3;
        case 'per_15min': {
            const quarters = Math.ceil(hours * 4);
            return (pump.operation_per_15min ?? 0) * quarters;
        }
        default:
            return 0;
    }
}
function applySurcharge(cfg, base_cost, hours) {
    if (!cfg)
        return 0;
    switch (cfg.model) {
        case 'percentage': return base_cost * (cfg.value / 100);
        case 'per_hour': return cfg.value * hours;
        case 'flat': return cfg.value;
        default: return 0;
    }
}
export function calculateSurcharges(surcharges, base_operation_cost, hours, date, is_night) {
    const dayType = date ? getDayType(date) : 'workday';
    const night = is_night ?? false;
    let saturday_czk = 0;
    let sunday_czk = 0;
    let holiday_czk = 0;
    let night_czk = 0;
    if (surcharges) {
        if (dayType === 'saturday') {
            saturday_czk = applySurcharge(surcharges.saturday, base_operation_cost, hours);
        }
        if (dayType === 'sunday') {
            sunday_czk = applySurcharge(surcharges.sunday, base_operation_cost, hours);
        }
        if (dayType === 'holiday') {
            holiday_czk = applySurcharge(surcharges.holiday ?? surcharges.sunday, // fall back to sunday rate
            base_operation_cost, hours);
        }
        if (night) {
            night_czk = applySurcharge(surcharges.night, base_operation_cost, hours);
        }
    }
    const total = saturday_czk + sunday_czk + holiday_czk + night_czk;
    return {
        day_type: dayType,
        is_night: night,
        saturday_czk: Math.round(saturday_czk),
        sunday_czk: Math.round(sunday_czk),
        holiday_czk: Math.round(holiday_czk),
        night_czk: Math.round(night_czk),
        total_czk: Math.round(total),
    };
}
/**
 * Calculate full pump cost for one supplier + one pump.
 */
export function calculatePumpCost(supplier, pump, input) {
    const arrival = calculateArrival(pump, input.distance_km) * input.num_arrivals;
    const operation = calculateOperation(supplier.billing_model, pump, input.hours, input.volume_m3);
    const hose = (supplier.hose_per_m_per_day ?? 0) * (input.extra_hose_m ?? 0);
    const surcharges = calculateSurcharges(supplier.surcharges, operation, input.hours, input.date, input.is_night);
    const subtotal = arrival + operation + hose;
    const total = subtotal + surcharges.total_czk;
    return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        pump_name: pump.name,
        pump_reach_m: pump.reach_m,
        arrival_czk: Math.round(arrival),
        operation_czk: Math.round(operation),
        hose_czk: Math.round(hose),
        surcharges,
        subtotal_czk: Math.round(subtotal),
        total_czk: Math.round(total),
        cost_per_m3: input.volume_m3 > 0 ? roundTo(total / input.volume_m3, 2) : 0,
    };
}
/**
 * Compare all suppliers for given parameters.
 * Returns sorted by total_czk (cheapest first).
 */
export function compareSuppliers(suppliers, input) {
    const results = [];
    for (const supplier of suppliers) {
        for (const pump of supplier.pumps) {
            if (pump.reach_m >= input.min_reach_m) {
                results.push(calculatePumpCost(supplier, pump, input));
            }
        }
    }
    return results.sort((a, b) => a.total_czk - b.total_czk);
}
// ─── Quick estimate for Planner integration ────────────────────────────────
/**
 * Quick pump cost estimate without supplier data.
 * Uses Czech market average rates for rough scheduling estimates.
 *
 * @returns Estimated CZK cost for pump rental
 */
export function quickPumpEstimate(params) {
    // Czech market averages (2026 prices)
    const AVG_RATE_CZK_H = 3500; // Average pump hourly rate
    const AVG_ARRIVAL_CZK = 5000; // Average arrival (30km)
    const AVG_ARRIVAL_PER_KM = 65; // Average per-km rate
    const arrival = params.distance_km
        ? AVG_ARRIVAL_CZK + Math.max(0, params.distance_km - 30) * AVG_ARRIVAL_PER_KM
        : AVG_ARRIVAL_CZK;
    const operation = AVG_RATE_CZK_H * params.hours;
    return {
        estimated_czk: Math.round(arrival + operation),
        rate_czk_h: AVG_RATE_CZK_H,
        arrival_czk: Math.round(arrival),
    };
}
// ─── Helpers ────────────────────────────────────────────────────────────────
function roundTo(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
