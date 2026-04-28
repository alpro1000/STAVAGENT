/**
 * DOV Write-Back Service
 *
 * When TOV data is saved for a position that has a position_instance_id,
 * this service POSTs the DOVPayload to Portal via:
 *   POST /api/positions/:instanceId/dov
 *
 * Non-blocking: Portal failures never break Registry operations.
 * Only fires if the item has a position_instance_id (Portal link).
 *
 * Spec: docs/POSITION_INSTANCE_ARCHITECTURE.ts → DOVPayload
 */

import type { TOVData } from '../types';

import { PORTAL_API_URL } from '../utils/config.js';
import { portalAuthHeader } from './portalAuth';
const WRITE_BACK_TIMEOUT = 5000;

/**
 * Convert Registry TOVData → Portal DOVPayload format.
 * Maps camelCase fields to snake_case as per POSITION_INSTANCE_ARCHITECTURE spec.
 */
export function buildDOVPayload(tov: TOVData): Record<string, unknown> {
  return {
    // Labor
    labor: (tov.labor || []).map(l => ({
      id: l.id,
      profession: l.profession,
      profession_code: l.professionCode || null,
      count: l.count,
      hours: l.hours,
      norm_hours: l.normHours,
      hourly_rate: l.hourlyRate || 0,
      total_cost_czk: l.totalCost || 0,
      linked_monolit_id: l.linkedCalcId || null,
    })),
    labor_summary: {
      total_norm_hours: tov.laborSummary?.totalNormHours || 0,
      total_workers: tov.laborSummary?.totalWorkers || 0,
      total_cost_czk: (tov.labor || []).reduce((s, l) => s + (l.totalCost || 0), 0),
    },

    // Machinery
    machinery: (tov.machinery || []).map(m => ({
      id: m.id,
      machine_type: m.type,
      machine_code: m.typeCode || null,
      count: m.count,
      hours: m.hours,
      machine_hours: m.machineHours,
      hourly_rate: m.hourlyRate || 0,
      total_cost_czk: m.totalCost || 0,
      linked_monolit_id: m.linkedCalcId || null,
    })),
    machinery_summary: {
      total_machine_hours: tov.machinerySummary?.totalMachineHours || 0,
      total_units: tov.machinerySummary?.totalUnits || 0,
      total_cost_czk: (tov.machinery || []).reduce((s, m) => s + (m.totalCost || 0), 0),
    },

    // Materials
    materials: (tov.materials || []).map(m => ({
      id: m.id,
      name: m.name,
      code: m.code || null,
      quantity: m.quantity,
      unit: m.unit,
      unit_price: m.unitPrice || 0,
      total_cost_czk: m.totalCost || 0,
      linked_monolit_id: m.linkedCalcId || null,
    })),
    materials_summary: {
      total_cost_czk: tov.materialsSummary?.totalCost || 0,
      item_count: tov.materialsSummary?.itemCount || 0,
    },

    // Formwork rental (only for BEDNĚNÍ positions)
    formwork_rental: tov.formworkRental || null,
    formwork_rental_summary: tov.formworkRental ? {
      total_rental_czk: (tov.formworkRental || []).reduce((s, r) => s + (r.najem_naklady || 0), 0),
      total_purchase_czk: (tov.formworkRental || []).reduce((s, r) => s + (r.podil_koupe || 0), 0),
      grand_total_czk: (tov.formworkRental || []).reduce((s, r) => s + (r.konecny_najem || 0), 0),
    } : null,

    // Pump rental (only for BETON_MONOLIT positions)
    pump_rental: tov.pumpRental || null,
    pump_rental_summary: tov.pumpRental ? {
      total_czk: tov.pumpRental.konecna_cena || 0,
    } : null,

    // Crane rental (mini-calculator)
    crane_rental: tov.craneRental || null,

    // Delivery calc (mini-calculator)
    delivery_calc: tov.deliveryCalc || null,

    // Grand total
    grand_total: {
      labor_czk: (tov.labor || []).reduce((s, l) => s + (l.totalCost || 0), 0),
      machinery_czk: (tov.machinery || []).reduce((s, m) => s + (m.totalCost || 0), 0),
      materials_czk: tov.materialsSummary?.totalCost || 0,
      rental_czk:
        ((tov.formworkRental || []).reduce((s, r) => s + (r.konecny_najem || 0), 0)) +
        (tov.pumpRental?.konecna_cena || 0) +
        (tov.craneRental?.total_czk || 0),
      delivery_czk: tov.deliveryCalc?.total_czk || 0,
      total_czk:
        (tov.labor || []).reduce((s, l) => s + (l.totalCost || 0), 0) +
        (tov.machinery || []).reduce((s, m) => s + (m.totalCost || 0), 0) +
        (tov.materialsSummary?.totalCost || 0) +
        ((tov.formworkRental || []).reduce((s, r) => s + (r.konecny_najem || 0), 0)) +
        (tov.pumpRental?.konecna_cena || 0) +
        (tov.craneRental?.total_czk || 0) +
        (tov.deliveryCalc?.total_czk || 0),
      currency: 'CZK' as const,
    },

    // Metadata
    calculated_at: new Date().toISOString(),
    calculated_by: 'manual',
    version: 1,
  };
}

/**
 * Write DOVPayload to Portal for a single position.
 * Non-blocking — logs errors but never throws.
 */
export async function writeBackDOV(
  positionInstanceId: string,
  tovData: TOVData
): Promise<boolean> {
  if (!positionInstanceId) return false;

  const url = `${PORTAL_API_URL}/api/positions/${positionInstanceId}/dov`;
  const payload = buildDOVPayload(tovData);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WRITE_BACK_TIMEOUT);

    // Auth wiring (PR-1 of cross-subdomain auth fix series). Without
    // this every DOV write-back silently 401'd against Portal's
    // requireAuth — Registry users could edit DOV cells but their
    // changes never reached the server (writeBackDOV() returns false
    // and the failure is logged but not surfaced to the UI).
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...portalAuthHeader(),
      },
      body: JSON.stringify({ payload }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      console.log(`[DOVWriteBack] DOV payload sent to Portal: ${positionInstanceId}`);
      return true;
    } else {
      console.warn(`[DOVWriteBack] Portal responded ${response.status} for ${positionInstanceId}`);
      return false;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[DOVWriteBack] Timeout writing DOV for ${positionInstanceId}`);
    } else {
      console.warn(`[DOVWriteBack] Failed for ${positionInstanceId}:`, error instanceof Error ? error.message : error);
    }
    return false;
  }
}
