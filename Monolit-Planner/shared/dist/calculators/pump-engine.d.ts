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
export type BillingModel = 'hourly' | 'hourly_plus_m3' | 'per_15min';
export interface PumpSpec {
    name: string;
    reach_m: number;
    /** Practical output (m³/h) — lower than technical max */
    practical_output_m3_h?: number;
    arrival_fixed?: number;
    arrival_per_km?: number;
    operation_per_h?: number;
    operation_per_15min?: number;
    volume_per_m3?: number;
}
export type SurchargeModel = 'percentage' | 'per_hour' | 'flat';
export interface SupplierSurcharges {
    saturday?: {
        model: SurchargeModel;
        value: number;
    };
    sunday?: {
        model: SurchargeModel;
        value: number;
    };
    holiday?: {
        model: SurchargeModel;
        value: number;
    };
    night?: {
        model: SurchargeModel;
        value: number;
    };
}
export interface SupplierData {
    id: string;
    name: string;
    billing_model: BillingModel;
    pumps: PumpSpec[];
    hose_per_m_per_day?: number;
    surcharges?: SupplierSurcharges;
}
export type DayType = 'workday' | 'saturday' | 'sunday' | 'holiday';
/**
 * Determine day type using Calendar Engine (accurate Easter calculation).
 */
export declare function getDayType(date: Date): DayType;
/**
 * Calculate arrival (mobilization) cost.
 */
export declare function calculateArrival(pump: PumpSpec, distance_km: number): number;
/**
 * Calculate operation cost based on billing model.
 */
export declare function calculateOperation(billing_model: BillingModel, pump: PumpSpec, hours: number, volume_m3: number): number;
/**
 * Calculate surcharges based on supplier model + day type.
 */
export interface SurchargeResult {
    day_type: DayType;
    is_night: boolean;
    saturday_czk: number;
    sunday_czk: number;
    holiday_czk: number;
    night_czk: number;
    total_czk: number;
}
export declare function calculateSurcharges(surcharges: SupplierSurcharges | undefined, base_operation_cost: number, hours: number, date?: Date, is_night?: boolean): SurchargeResult;
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
    /** Extra hose length (m). Default: 0 */
    extra_hose_m?: number;
    /** Date for surcharge calc. Default: no surcharges. */
    date?: Date;
    is_night?: boolean;
}
/**
 * Calculate full pump cost for one supplier + one pump.
 */
export declare function calculatePumpCost(supplier: SupplierData, pump: PumpSpec, input: PumpCostInput): PumpCostResult;
/**
 * Compare all suppliers for given parameters.
 * Returns sorted by total_czk (cheapest first).
 */
export declare function compareSuppliers(suppliers: SupplierData[], input: PumpCostInput): PumpCostResult[];
/**
 * Quick pump cost estimate without supplier data.
 * Uses Czech market average rates for rough scheduling estimates.
 *
 * @returns Estimated CZK cost for pump rental
 */
export declare function quickPumpEstimate(params: {
    volume_m3: number;
    hours: number;
    distance_km?: number;
}): {
    estimated_czk: number;
    rate_czk_h: number;
    arrival_czk: number;
};
