/**
 * RailQuantity helpers — every number leaves the engine with a formula,
 * a source and a confidence; honest-blank is a first-class value.
 */
import type { RailQuantity, RailQuantitySource } from '../types.js';

export function qOk(
  value: number,
  unit: string,
  formula: string,
  source: RailQuantitySource,
  confidence: number,
): RailQuantity {
  return { value, unit, formula, source, confidence, status: 'ok' };
}

export function qBlank(
  unit: string,
  reason_cs: string,
  source: RailQuantitySource = { document: '—' },
): RailQuantity {
  return {
    value: null,
    unit,
    formula: 'NEPOČÍTÁNO',
    source,
    confidence: 0,
    status: 'nepocitano',
    reason_cs,
  };
}

/** Round to a sane number of decimals for display-stable replay output. */
export function round(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
