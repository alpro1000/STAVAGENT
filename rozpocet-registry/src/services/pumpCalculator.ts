/**
 * Multi-Supplier Pump Calculator
 * Supports different billing models: hourly, hourly_plus_m3, per_15min
 */

import pumpSuppliers from '../data/pump_suppliers.json';

export interface PumpSupplier {
  id: string;
  name: string;
  billing_model: 'hourly' | 'hourly_plus_m3' | 'per_15min';
  pumps: PumpModel[];
  hose_per_m_per_day: number;
  surcharges: any;
}

export interface PumpModel {
  name: string;
  reach_m: number;
  arrival_fixed?: number;
  arrival_per_km?: number;
  operation_per_h?: number;
  operation_per_15min?: number;
  volume_per_m3?: number;
}

export function getSuppliers(): PumpSupplier[] {
  return pumpSuppliers.suppliers as PumpSupplier[];
}

export function getSupplier(id: string): PumpSupplier | undefined {
  return getSuppliers().find(s => s.id === id);
}

/**
 * Calculate arrival cost based on supplier billing model
 */
export function calculateArrival(
  _supplier: PumpSupplier,
  pump: PumpModel,
  distance_km: number
): number {
  if (pump.arrival_fixed !== undefined && pump.arrival_per_km !== undefined) {
    // Beton Union: fixed + km × rate × 2
    return pump.arrival_fixed + distance_km * pump.arrival_per_km * 2;
  }
  if (pump.arrival_per_km !== undefined) {
    // Berger: km × rate × 2
    return distance_km * pump.arrival_per_km * 2;
  }
  if (pump.arrival_fixed !== undefined) {
    // Frischbeton: one-time fixed
    return pump.arrival_fixed;
  }
  return 0;
}

/**
 * Calculate operation cost based on supplier billing model
 */
export function calculateOperation(
  supplier: PumpSupplier,
  pump: PumpModel,
  hours: number,
  volume_m3: number
): number {
  switch (supplier.billing_model) {
    case 'hourly':
      // Beton Union: rate × hours
      return (pump.operation_per_h || 0) * hours;
    
    case 'hourly_plus_m3':
      // Berger: rate × hours + volume × rate_m3
      return (pump.operation_per_h || 0) * hours + (pump.volume_per_m3 || 0) * volume_m3;
    
    case 'per_15min':
      // Frischbeton: ceil(hours × 4) × rate_per_15min
      const quarters = Math.ceil(hours * 4);
      return (pump.operation_per_15min || 0) * quarters;
    
    default:
      return 0;
  }
}

/**
 * Calculate total pump cost for comparison
 */
export function calculateTotalCost(
  supplier: PumpSupplier,
  pump: PumpModel,
  distance_km: number,
  hours: number,
  volume_m3: number,
  num_arrivals: number
): {
  arrival: number;
  operation: number;
  total: number;
} {
  const arrival = calculateArrival(supplier, pump, distance_km) * num_arrivals;
  const operation = calculateOperation(supplier, pump, hours, volume_m3);
  
  return {
    arrival,
    operation,
    total: arrival + operation
  };
}

/**
 * Compare all suppliers for given parameters
 */
export function compareSuppliers(params: {
  distance_km: number;
  hours: number;
  volume_m3: number;
  num_arrivals: number;
  min_reach_m: number;
  /** Optional: date for calendar surcharges */
  date?: Date;
  /** Optional: work starts after 18:00 = night */
  is_night?: boolean;
}): Array<{
  supplier: PumpSupplier;
  pump: PumpModel;
  cost: ReturnType<typeof calculateTotalCost>;
  surcharges: SurchargeBreakdown;
  total_with_surcharges: number;
}> {
  const results: Array<{
    supplier: PumpSupplier;
    pump: PumpModel;
    cost: ReturnType<typeof calculateTotalCost>;
    surcharges: SurchargeBreakdown;
    total_with_surcharges: number;
  }> = [];

  for (const supplier of getSuppliers()) {
    for (const pump of supplier.pumps) {
      if (pump.reach_m >= params.min_reach_m) {
        const cost = calculateTotalCost(
          supplier,
          pump,
          params.distance_km,
          params.hours,
          params.volume_m3,
          params.num_arrivals
        );
        const surcharges = calculateSurcharges(
          supplier,
          cost.operation,
          params.hours,
          params.date,
          params.is_night
        );
        results.push({
          supplier,
          pump,
          cost,
          surcharges,
          total_with_surcharges: cost.total + surcharges.total_surcharge,
        });
      }
    }
  }

  return results.sort((a, b) => a.total_with_surcharges - b.total_with_surcharges);
}

// ─── Calendar & Surcharge Logic ─────────────────────────────────────────────

/** Czech public holidays (month-day) */
const CZ_HOLIDAYS: string[] = [
  '01-01', // Nový rok
  '03-29', // Velký pátek (approx, varies)
  '03-31', // Velikonoční pondělí (approx, varies)
  '05-01', // Svátek práce
  '05-08', // Den vítězství
  '07-05', // Den slovanských věrozvěstů
  '07-06', // Den upálení Jana Husa
  '09-28', // Den české státnosti
  '10-28', // Den vzniku ČSR
  '11-17', // Den boje za svobodu
  '12-24', // Štědrý den
  '12-25', // 1. svátek vánoční
  '12-26', // 2. svátek vánoční
];

export type DayType = 'workday' | 'saturday' | 'sunday' | 'holiday';

/**
 * Determine day type for surcharge calculation.
 */
export function getDayType(date: Date): DayType {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (CZ_HOLIDAYS.includes(mmdd)) return 'holiday';
  const dow = date.getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'workday';
}

export interface SurchargeBreakdown {
  day_type: DayType;
  is_night: boolean;
  saturday_surcharge: number;
  sunday_surcharge: number;
  holiday_surcharge: number;
  night_surcharge: number;
  total_surcharge: number;
}

/**
 * Calculate surcharges based on supplier pricing model, date, and time.
 *
 * Suppliers use different surcharge models:
 * - Percentage-based (Berger): saturday_pct, sunday_pct, night_pct
 * - Fixed per-hour (Frischbeton): sunday_per_h, night_per_h
 * - Fixed flat (Beton Union): saturday, sunday, night (one-time fee)
 */
export function calculateSurcharges(
  supplier: PumpSupplier,
  base_operation_cost: number,
  hours: number,
  date?: Date,
  is_night?: boolean,
): SurchargeBreakdown {
  const dayType = date ? getDayType(date) : 'workday';
  const night = is_night ?? false;
  const s = supplier.surcharges || {};

  let saturday_surcharge = 0;
  let sunday_surcharge = 0;
  let holiday_surcharge = 0;
  let night_surcharge = 0;

  // Saturday
  if (dayType === 'saturday') {
    if (s.saturday_pct) {
      saturday_surcharge = base_operation_cost * (s.saturday_pct / 100);
    } else if (s.saturday) {
      saturday_surcharge = s.saturday; // flat fee
    }
  }

  // Sunday or holiday
  if (dayType === 'sunday' || dayType === 'holiday') {
    if (s.sunday_pct) {
      sunday_surcharge = base_operation_cost * (s.sunday_pct / 100);
    } else if (s.sunday_per_h) {
      sunday_surcharge = s.sunday_per_h * hours;
    } else if (s.sunday) {
      sunday_surcharge = s.sunday; // flat fee
    }
    // Holiday uses sunday rates (industry standard in CZ)
    if (dayType === 'holiday') {
      holiday_surcharge = sunday_surcharge;
      sunday_surcharge = 0;
    }
  }

  // Night
  if (night) {
    if (s.night_pct) {
      night_surcharge = base_operation_cost * (s.night_pct / 100);
    } else if (s.night_per_h) {
      night_surcharge = s.night_per_h * hours;
    } else if (s.night) {
      night_surcharge = s.night; // flat fee
    }
  }

  return {
    day_type: dayType,
    is_night: night,
    saturday_surcharge: Math.round(saturday_surcharge),
    sunday_surcharge: Math.round(sunday_surcharge),
    holiday_surcharge: Math.round(holiday_surcharge),
    night_surcharge: Math.round(night_surcharge),
    total_surcharge: Math.round(saturday_surcharge + sunday_surcharge + holiday_surcharge + night_surcharge),
  };
}
