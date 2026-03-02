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
  surcharges: Record<string, number>;
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
  supplier: PumpSupplier,
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
}): Array<{
  supplier: PumpSupplier;
  pump: PumpModel;
  cost: ReturnType<typeof calculateTotalCost>;
}> {
  const results: Array<{
    supplier: PumpSupplier;
    pump: PumpModel;
    cost: ReturnType<typeof calculateTotalCost>;
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
        results.push({ supplier, pump, cost });
      }
    }
  }

  return results.sort((a, b) => a.cost.total - b.cost.total);
}
