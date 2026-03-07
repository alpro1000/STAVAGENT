/**
 * Pump Calculator — Registry adapter
 *
 * Wraps pump_suppliers.json and exposes the same API as the shared
 * pump-engine (Monolit-Planner/shared/src/calculators/pump-engine.ts).
 *
 * Data: pump_suppliers.json uses a flat surcharge format (saturday_pct, etc.).
 * This module adapts it to structured {model, value} internally so that the
 * calculation logic matches the shared engine exactly.
 *
 * Czech holiday detection uses accurate Easter algorithm (Gauss / Butcher)
 * instead of hardcoded MM-DD strings (which get Easter wrong every year).
 *
 * Exported API (mirrors shared pump-engine):
 *   - getSuppliers()                  ← backward-compat, raw JSON data
 *   - calculateArrival()
 *   - calculateOperation()
 *   - calculateSurcharges()
 *   - calculatePumpCost()
 *   - compareSuppliers()
 *   - getDayType()
 *   - quickPumpEstimate()
 */

import pumpSuppliersJson from '../data/pump_suppliers.json';

// ─── Raw JSON types (backward compat for PumpRentalSection) ──────────────────

export interface PumpModel {
  name: string;
  reach_m: number;
  arrival_fixed?: number;
  arrival_per_km?: number;
  operation_per_h?: number;
  operation_per_15min?: number;
  volume_per_m3?: number;
}

export interface PumpSupplier {
  id: string;
  name: string;
  billing_model: BillingModel;
  pumps: PumpModel[];
  hose_per_m_per_day: number;
  surcharges: Record<string, number>;
}

/** Returns raw supplier data from JSON (for PumpRentalSection dropdown). */
export function getSuppliers(): PumpSupplier[] {
  return pumpSuppliersJson.suppliers as PumpSupplier[];
}

export function getSupplier(id: string): PumpSupplier | undefined {
  return getSuppliers().find(s => s.id === id);
}

// ─── Shared engine types ─────────────────────────────────────────────────────

export type BillingModel = 'hourly' | 'hourly_plus_m3' | 'per_15min';
export type SurchargeModel = 'percentage' | 'per_hour' | 'flat';
export type DayType = 'workday' | 'saturday' | 'sunday' | 'holiday';

export interface PumpSpec {
  name: string;
  reach_m: number;
  practical_output_m3_h?: number;
  arrival_fixed?: number;
  arrival_per_km?: number;
  operation_per_h?: number;
  operation_per_15min?: number;
  volume_per_m3?: number;
}

export interface SupplierSurchargeEntry {
  model: SurchargeModel;
  value: number;
}

export interface SupplierSurcharges {
  saturday?: SupplierSurchargeEntry;
  sunday?: SupplierSurchargeEntry;
  holiday?: SupplierSurchargeEntry;
  night?: SupplierSurchargeEntry;
}

export interface SupplierData {
  id: string;
  name: string;
  billing_model: BillingModel;
  pumps: PumpSpec[];
  hose_per_m_per_day?: number;
  surcharges?: SupplierSurcharges;
}

export interface SurchargeResult {
  day_type: DayType;
  is_night: boolean;
  saturday_czk: number;
  sunday_czk: number;
  holiday_czk: number;
  night_czk: number;
  total_czk: number;
}

export interface PumpCostResult {
  supplier_id: string;
  supplier_name: string;
  pump_name: string;
  pump_reach_m: number;
  arrival_czk: number;
  operation_czk: number;
  hose_czk: number;
  surcharges: SurchargeResult;
  subtotal_czk: number;
  total_czk: number;
  /** CZK per m³ (total ÷ volume) */
  cost_per_m3: number;
}

export interface PumpCostInput {
  distance_km: number;
  hours: number;
  volume_m3: number;
  num_arrivals: number;
  min_reach_m: number;
  extra_hose_m?: number;
  date?: Date;
  is_night?: boolean;
}

// ─── Czech holiday detection (accurate Easter calculation) ────────────────────

const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1], [5, 1], [5, 8], [7, 5], [7, 6],
  [9, 28], [10, 28], [11, 17], [12, 24], [12, 25], [12, 26],
];

/** Gauss/Butcher Easter Sunday algorithm */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isCzechHoliday(date: Date): boolean {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  for (const [hm, hd] of FIXED_HOLIDAYS) {
    if (m === hm && d === hd) return true;
  }
  // Good Friday
  const easter = easterSunday(date.getFullYear());
  const goodFriday = new Date(easter);
  goodFriday.setDate(goodFriday.getDate() - 2);
  // Easter Monday
  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);
  for (const holiday of [goodFriday, easterMonday]) {
    if (
      date.getFullYear() === holiday.getFullYear() &&
      date.getMonth() === holiday.getMonth() &&
      date.getDate() === holiday.getDate()
    ) return true;
  }
  return false;
}

/** Determine day type using accurate Czech holiday detection. */
export function getDayType(date: Date): DayType {
  if (isCzechHoliday(date)) return 'holiday';
  const dow = date.getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'workday';
}

// ─── JSON → SupplierData adapter ─────────────────────────────────────────────

/**
 * Convert flat JSON surcharge format to structured SupplierSurcharges.
 *
 * JSON formats found in pump_suppliers.json:
 *   { saturday_pct: 15 }       → { model: 'percentage', value: 15 }
 *   { sunday_per_h: 220 }      → { model: 'per_hour', value: 220 }
 *   { saturday: 1500 }         → { model: 'flat', value: 1500 }
 */
function adaptSurcharges(raw: Record<string, number>): SupplierSurcharges {
  const result: SupplierSurcharges = {};

  // Saturday
  if (raw.saturday_pct != null) {
    result.saturday = { model: 'percentage', value: raw.saturday_pct };
  } else if (raw.saturday != null) {
    result.saturday = { model: 'flat', value: raw.saturday };
  }

  // Sunday
  if (raw.sunday_pct != null) {
    result.sunday = { model: 'percentage', value: raw.sunday_pct };
  } else if (raw.sunday_per_h != null) {
    result.sunday = { model: 'per_hour', value: raw.sunday_per_h };
  } else if (raw.sunday != null) {
    result.sunday = { model: 'flat', value: raw.sunday };
  }

  // Holiday (CZ standard: same as sunday if not specified)
  if (raw.holiday_pct != null) {
    result.holiday = { model: 'percentage', value: raw.holiday_pct };
  } else if (raw.holiday_per_h != null) {
    result.holiday = { model: 'per_hour', value: raw.holiday_per_h };
  } else if (raw.holiday != null) {
    result.holiday = { model: 'flat', value: raw.holiday };
  }
  // If no explicit holiday rate, falls back to sunday rate (handled in calculateSurcharges)

  // Night
  if (raw.night_pct != null) {
    result.night = { model: 'percentage', value: raw.night_pct };
  } else if (raw.night_per_h != null) {
    result.night = { model: 'per_hour', value: raw.night_per_h };
  } else if (raw.night != null) {
    result.night = { model: 'flat', value: raw.night };
  }

  return result;
}

/** Convert raw PumpSupplier (JSON) to SupplierData (engine format). */
function toSupplierData(s: PumpSupplier): SupplierData {
  return {
    id: s.id,
    name: s.name,
    billing_model: s.billing_model,
    pumps: s.pumps,
    hose_per_m_per_day: s.hose_per_m_per_day,
    surcharges: s.surcharges ? adaptSurcharges(s.surcharges) : undefined,
  };
}

// ─── Calculation functions (mirrors shared pump-engine exactly) ───────────────

/** Calculate arrival (mobilization) cost. */
export function calculateArrival(pump: PumpSpec, distance_km: number): number {
  let cost = 0;
  if (pump.arrival_fixed) cost += pump.arrival_fixed;
  if (pump.arrival_per_km) cost += distance_km * pump.arrival_per_km * 2; // round trip
  return Math.round(cost);
}

/** Calculate operation cost based on billing model. */
export function calculateOperation(
  billing_model: BillingModel,
  pump: PumpSpec,
  hours: number,
  volume_m3: number,
): number {
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

function applySurchargeEntry(
  cfg: SupplierSurchargeEntry | undefined,
  base_cost: number,
  hours: number,
): number {
  if (!cfg) return 0;
  switch (cfg.model) {
    case 'percentage': return base_cost * (cfg.value / 100);
    case 'per_hour': return cfg.value * hours;
    case 'flat': return cfg.value;
    default: return 0;
  }
}

/** Calculate surcharges (weekend/holiday/night) based on structured config. */
export function calculateSurcharges(
  surcharges: SupplierSurcharges | undefined,
  base_operation_cost: number,
  hours: number,
  date?: Date,
  is_night?: boolean,
): SurchargeResult {
  const dayType = date ? getDayType(date) : 'workday';
  const night = is_night ?? false;

  let saturday_czk = 0;
  let sunday_czk = 0;
  let holiday_czk = 0;
  let night_czk = 0;

  if (surcharges) {
    if (dayType === 'saturday') {
      saturday_czk = applySurchargeEntry(surcharges.saturday, base_operation_cost, hours);
    }
    if (dayType === 'sunday') {
      sunday_czk = applySurchargeEntry(surcharges.sunday, base_operation_cost, hours);
    }
    if (dayType === 'holiday') {
      // Holiday falls back to sunday rate if no explicit holiday rate
      holiday_czk = applySurchargeEntry(
        surcharges.holiday ?? surcharges.sunday,
        base_operation_cost,
        hours,
      );
    }
    if (night) {
      night_czk = applySurchargeEntry(surcharges.night, base_operation_cost, hours);
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

/** Calculate full pump cost for one supplier + one pump. */
export function calculatePumpCost(
  supplier: SupplierData,
  pump: PumpSpec,
  input: PumpCostInput,
): PumpCostResult {
  const arrival = calculateArrival(pump, input.distance_km) * input.num_arrivals;
  const operation = calculateOperation(supplier.billing_model, pump, input.hours, input.volume_m3);
  const hose = (supplier.hose_per_m_per_day ?? 0) * (input.extra_hose_m ?? 0);
  const surcharges = calculateSurcharges(
    supplier.surcharges,
    operation,
    input.hours,
    input.date,
    input.is_night,
  );

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
    cost_per_m3: input.volume_m3 > 0
      ? Math.round((total / input.volume_m3) * 100) / 100
      : 0,
  };
}

/**
 * Compare all suppliers for given parameters.
 * Returns sorted by total_czk (cheapest first).
 */
export function compareSuppliers(
  input: PumpCostInput,
): PumpCostResult[] {
  const suppliers = getSuppliers().map(toSupplierData);
  const results: PumpCostResult[] = [];

  for (const supplier of suppliers) {
    for (const pump of supplier.pumps) {
      if (pump.reach_m >= input.min_reach_m) {
        results.push(calculatePumpCost(supplier, pump, input));
      }
    }
  }

  return results.sort((a, b) => a.total_czk - b.total_czk);
}

/**
 * Quick pump cost estimate (no supplier data needed).
 * Uses Czech market average rates for rough scheduling estimates.
 */
export function quickPumpEstimate(params: {
  volume_m3: number;
  hours: number;
  distance_km?: number;
}): { estimated_czk: number; rate_czk_h: number; arrival_czk: number } {
  const AVG_RATE_CZK_H = 3500;
  const AVG_ARRIVAL_CZK = 5000;
  const AVG_ARRIVAL_PER_KM = 65;

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

// ─── Legacy compat: SurchargeBreakdown (old format used by PumpRentalSection) ─

/** @deprecated Use SurchargeResult from calculateSurcharges() instead */
export interface SurchargeBreakdown {
  day_type: DayType;
  is_night: boolean;
  saturday_surcharge: number;
  sunday_surcharge: number;
  holiday_surcharge: number;
  night_surcharge: number;
  total_surcharge: number;
}
