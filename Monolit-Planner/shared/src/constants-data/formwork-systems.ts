/**
 * Formwork Systems Catalog — Single Source of Truth
 *
 * Canonical data for all formwork systems used across backend and frontend.
 * Sources: DOKA price lists 2024, B3_current_prices, industry standards.
 *
 * Import this instead of maintaining separate copies in frontend/backend.
 */

/** Formwork system specification */
export interface FormworkSystemSpec {
  name: string;
  manufacturer: string;
  heights: string[];
  /** Assembly labor norm (hours per m² or per bm when unit='bm') */
  assembly_h_m2: number;
  /** Disassembly labor norm (hours per m² or per bm) — derived: assembly_h_m2 × disassembly_ratio */
  disassembly_h_m2: number;
  /** Disassembly as fraction of assembly time (0.25–0.50) */
  disassembly_ratio: number;
  /** Monthly rental price per m² (or per bm). 0 = no rental (e.g. traditional timber) */
  rental_czk_m2_month: number;
  /** Measurement unit: 'm2' (default) or 'bm' (linear meters, e.g. cornice formwork) */
  unit: 'm2' | 'bm';
  description: string;
}

/**
 * All formwork systems — 8 systems
 *
 * Assembly norms represent person-hours per m² (or per bm).
 * Disassembly_h_m2 = assembly_h_m2 × disassembly_ratio.
 */
export const FORMWORK_SYSTEMS: FormworkSystemSpec[] = [
  {
    name: 'Frami Xlife',
    manufacturer: 'DOKA',
    heights: ['0.30', '0.60', '0.90', '1.20', '1.50'],
    assembly_h_m2: 0.72,
    disassembly_h_m2: 0.25,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 507.20,
    unit: 'm2',
    description: 'Rámové bednění pro základy, opěry, nízké stěny',
  },
  {
    name: 'Framax Xlife',
    manufacturer: 'DOKA',
    heights: ['2.70', '3.00', '3.30', '5.40'],
    assembly_h_m2: 0.55,
    disassembly_h_m2: 0.17,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 520.00,
    unit: 'm2',
    description: 'Velkoformátové rámové bednění pro vysoké stěny, pilíře',
  },
  {
    name: 'TRIO',
    manufacturer: 'PERI',
    heights: ['2.70', '3.30'],
    assembly_h_m2: 0.50,
    disassembly_h_m2: 0.15,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 480.00,
    unit: 'm2',
    description: 'Rámové bednění PERI pro stěny a sloupy',
  },
  {
    name: 'Top 50',
    manufacturer: 'DOKA',
    heights: ['0.50', '1.00', '1.50', '2.00'],
    assembly_h_m2: 0.60,
    disassembly_h_m2: 0.21,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 380.00,
    unit: 'm2',
    description: 'Stropní bednění, desky, mostovky',
  },
  {
    name: 'Dokaflex',
    manufacturer: 'DOKA',
    heights: ['do 5.50'],
    assembly_h_m2: 0.45,
    disassembly_h_m2: 0.14,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 350.00,
    unit: 'm2',
    description: 'Flexibilní stropní bednění s nosníky H20',
  },
  {
    name: 'SL-1 Sloupové',
    manufacturer: 'DOKA',
    heights: ['3.00', '4.50', '6.00'],
    assembly_h_m2: 0.80,
    disassembly_h_m2: 0.28,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 580.00,
    unit: 'm2',
    description: 'Sloupové bednění pro pilíře mostů',
  },
  {
    name: 'Tradiční tesařské',
    manufacturer: 'Místní',
    heights: ['libovolná'],
    assembly_h_m2: 1.30,
    disassembly_h_m2: 0.65,
    disassembly_ratio: 0.50,
    rental_czk_m2_month: 0,
    unit: 'm2',
    description: 'Jednorázové tesařské bednění (bez pronájmu, materiál)',
  },
  {
    name: 'Římsové bednění T',
    manufacturer: 'DOKA',
    heights: ['libovolná'],
    assembly_h_m2: 0.38,
    disassembly_h_m2: 0.10,
    disassembly_ratio: 0.25,
    rental_czk_m2_month: 0,
    unit: 'bm',
    description: 'Konzolové bednění říms mostu (0,30–0,45 h/bm)',
  },
];

/** Find a formwork system by name */
export function findFormworkSystem(name: string): FormworkSystemSpec | undefined {
  return FORMWORK_SYSTEMS.find(s => s.name === name);
}

/** Get default formwork system (Frami Xlife) */
export function getDefaultFormworkSystem(): FormworkSystemSpec {
  return FORMWORK_SYSTEMS[0];
}
