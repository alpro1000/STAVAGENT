/**
 * Formwork Systems Catalog
 * Pre-filled catalog of formwork systems with typical rental prices and labor norms
 * Sources: DOKA price lists, B3_current_prices, industry standards
 */

import type { FormworkSystem } from '@stavagent/monolit-shared';

export const FORMWORK_SYSTEMS: FormworkSystem[] = [
  {
    name: 'Frami Xlife',
    manufacturer: 'DOKA',
    heights: ['0.30', '0.60', '0.90', '1.20', '1.50'],
    rental_czk_m2_month: 507.20,
    assembly_h_m2: 0.72,
    disassembly_ratio: 0.35,
    description: 'Rámové bednění pro základy, opěry, nízké stěny'
  },
  {
    name: 'Framax Xlife',
    manufacturer: 'DOKA',
    heights: ['2.70', '3.00', '3.30', '5.40'],
    rental_czk_m2_month: 520.00,
    assembly_h_m2: 0.55,
    disassembly_ratio: 0.30,
    description: 'Velkoformátové rámové bednění pro vysoké stěny, pilíře'
  },
  {
    name: 'TRIO',
    manufacturer: 'PERI',
    heights: ['2.70', '3.30'],
    rental_czk_m2_month: 480.00,
    assembly_h_m2: 0.50,
    disassembly_ratio: 0.30,
    description: 'Rámové bednění PERI pro stěny a sloupy'
  },
  {
    name: 'Top 50',
    manufacturer: 'DOKA',
    heights: ['0.50', '1.00', '1.50', '2.00'],
    rental_czk_m2_month: 380.00,
    assembly_h_m2: 0.60,
    disassembly_ratio: 0.35,
    description: 'Stropní bednění, desky, mostovky'
  },
  {
    name: 'Dokaflex',
    manufacturer: 'DOKA',
    heights: ['do 5.50'],
    rental_czk_m2_month: 350.00,
    assembly_h_m2: 0.45,
    disassembly_ratio: 0.30,
    description: 'Flexibilní stropní bednění s nosníky H20'
  },
  {
    name: 'SL-1 Sloupové',
    manufacturer: 'DOKA',
    heights: ['3.00', '4.50', '6.00'],
    rental_czk_m2_month: 580.00,
    assembly_h_m2: 0.80,
    disassembly_ratio: 0.35,
    description: 'Sloupové bednění pro pilíře mostů'
  },
  {
    name: 'Tradiční tesařské',
    manufacturer: 'Místní',
    heights: ['libovolná'],
    rental_czk_m2_month: 0,
    assembly_h_m2: 1.30,
    disassembly_ratio: 0.50,
    description: 'Jednorázové tesařské bednění (bez pronájmu, materiál)'
  }
];

/**
 * Find a formwork system by name
 */
export function findFormworkSystem(name: string): FormworkSystem | undefined {
  return FORMWORK_SYSTEMS.find(s => s.name === name);
}

/**
 * Get default formwork system
 */
export function getDefaultFormworkSystem(): FormworkSystem {
  return FORMWORK_SYSTEMS[0]; // Frami Xlife
}
