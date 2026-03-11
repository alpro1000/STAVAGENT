/**
 * Formwork Systems Catalog
 * Re-exports canonical data from @stavagent/monolit-shared.
 *
 * All formwork system specs (norms, rental prices, disassembly ratios)
 * are defined in shared/src/data/formwork-systems.ts — single source of truth.
 */

import type { FormworkSystem } from '@stavagent/monolit-shared';
import {
  FORMWORK_SYSTEMS as SHARED_SYSTEMS,
  findFormworkSystem as sharedFind,
  getDefaultFormworkSystem as sharedDefault,
  type FormworkSystemSpec,
} from '@stavagent/monolit-shared';

/**
 * Map shared FormworkSystemSpec → legacy FormworkSystem interface
 * (adds manufacturer, heights, description which the frontend type expects)
 */
export const FORMWORK_SYSTEMS: FormworkSystem[] = SHARED_SYSTEMS.map(s => ({
  name: s.name,
  manufacturer: s.manufacturer,
  heights: s.heights,
  rental_czk_m2_month: s.rental_czk_m2_month,
  assembly_h_m2: s.assembly_h_m2,
  disassembly_ratio: s.disassembly_ratio,
  description: s.description,
  unit: s.unit === 'bm' ? 'bm' : 'm2',
}));

/** Find a formwork system by name */
export function findFormworkSystem(name: string): FormworkSystem | undefined {
  return FORMWORK_SYSTEMS.find(s => s.name === name);
}

/** Get default formwork system */
export function getDefaultFormworkSystem(): FormworkSystem {
  return FORMWORK_SYSTEMS[0]; // Frami Xlife
}

/** Re-export the shared spec type for direct access when needed */
export type { FormworkSystemSpec };
