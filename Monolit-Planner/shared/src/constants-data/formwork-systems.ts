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
 * All formwork systems — 25 systems (DOKA, PERI, ULMA, NOE, Místní)
 *
 * Assembly norms represent person-hours per m² (or per bm).
 * Disassembly_h_m2 = assembly_h_m2 × disassembly_ratio.
 *
 * Sources: DOKA price lists 2024, PERI catalog 2024, ULMA CZ 2024,
 *          NOE-Schaltechnik catalog 2024, industry standards.
 */
export const FORMWORK_SYSTEMS: FormworkSystemSpec[] = [
  // ── DOKA ─────────────────────────────────────────────────────────────
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
  // ── PERI ─────────────────────────────────────────────────────────────
  {
    name: 'TRIO',
    manufacturer: 'PERI',
    heights: ['2.70', '3.30', '5.40'],
    assembly_h_m2: 0.50,
    disassembly_h_m2: 0.15,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 736.00,
    unit: 'm2',
    description: 'Rámové bednění PERI pro dříky opěr mostů (h=2,7–5,4 m)',
  },
  {
    name: 'MAXIMO',
    manufacturer: 'PERI',
    heights: ['2.70', '3.30', '3.60'],
    assembly_h_m2: 0.40,
    disassembly_h_m2: 0.12,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 550.00,
    unit: 'm2',
    description: 'Velkoformátové stěnové bednění bez viditelných kotev',
  },
  {
    name: 'DOMINO',
    manufacturer: 'PERI',
    heights: ['1.00', '1.25', '1.50', '2.00', '2.25', '2.50', '3.75'],
    assembly_h_m2: 0.65,
    disassembly_h_m2: 0.20,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 658.00,
    unit: 'm2',
    description: 'Lehké ruční bednění pro základy opěr, dříky opěr a propustky (mostní stavby)',
  },
  {
    name: 'SKYDECK',
    manufacturer: 'PERI',
    heights: ['do 6.00'],
    assembly_h_m2: 0.35,
    disassembly_h_m2: 0.11,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 400.00,
    unit: 'm2',
    description: 'Panelové stropní bednění — rychlá montáž zespodu',
  },
  {
    name: 'VARIO GT 24',
    manufacturer: 'PERI',
    heights: ['3.00', '6.00', '9.00', '12.00'],
    assembly_h_m2: 0.85,
    disassembly_h_m2: 0.26,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 600.00,
    unit: 'm2',
    description: 'Nosníkové bednění pro vysoké stěny a pilíře (do 12 m)',
  },
  {
    name: 'VARIO',
    manufacturer: 'PERI',
    heights: ['4.50', '6.00', '8.10', '12.50'],
    assembly_h_m2: 0.90,
    disassembly_h_m2: 0.27,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 807.00,
    unit: 'm2',
    description: 'Zakázkové panelové bednění PERI pro mostní pilíře (průřezy 1,2–2,4 m, výšky 4,5–12,5 m)',
  },
  {
    name: 'DUO',
    manufacturer: 'PERI',
    heights: ['0.75', '1.00', '1.25', '1.50', '2.70'],
    assembly_h_m2: 0.55,
    disassembly_h_m2: 0.17,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 450.00,
    unit: 'm2',
    description: 'Univerzální lehké bednění PERI pro stěny i stropy (panel 8,5 kg, bez jeřábu)',
  },
  {
    name: 'QUATTRO',
    manufacturer: 'PERI',
    heights: ['2.70', '3.00', '3.30', '4.50'],
    assembly_h_m2: 0.75,
    disassembly_h_m2: 0.23,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 560.00,
    unit: 'm2',
    description: 'Sloupové bednění PERI pro čtvercové/obdélníkové sloupy (do 80 cm)',
  },
  {
    name: 'MULTIFLEX',
    manufacturer: 'PERI',
    heights: ['do 5.00'],
    assembly_h_m2: 0.50,
    disassembly_h_m2: 0.16,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 380.00,
    unit: 'm2',
    description: 'Flexibilní nosníkové stropní bednění PERI s GT 24 nosníky',
  },
  {
    name: 'RUNDFLEX',
    manufacturer: 'PERI',
    heights: ['2.70', '3.00', '3.30'],
    assembly_h_m2: 0.80,
    disassembly_h_m2: 0.24,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 620.00,
    unit: 'm2',
    description: 'Kruhové stěnové bednění PERI pro válcové konstrukce (R ≥ 1,0 m)',
  },
  {
    name: 'SRS',
    manufacturer: 'PERI',
    heights: ['3.00', '4.50', '6.00'],
    assembly_h_m2: 1.10,
    disassembly_h_m2: 0.35,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 720.00,
    unit: 'm2',
    description: 'Šplhací bednění PERI na kolejnicích pro vysoké konstrukce (jádra, pilíře)',
  },
  {
    name: 'VARIOKIT',
    manufacturer: 'PERI',
    heights: ['libovolná'],
    assembly_h_m2: 1.00,
    disassembly_h_m2: 0.35,
    disassembly_ratio: 0.35,
    rental_czk_m2_month: 850.00,
    unit: 'm2',
    description: 'Inženýrská stavebnice PERI pro mosty a tunely (VGK, VGB, VST moduly)',
  },
  {
    name: 'CB 240',
    manufacturer: 'PERI',
    heights: ['3.00', '4.50'],
    assembly_h_m2: 0.95,
    disassembly_h_m2: 0.30,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 680.00,
    unit: 'm2',
    description: 'Šplhací konzola PERI pro jednostranné bednění (nosnost 240 kN)',
  },
  // ── ULMA ─────────────────────────────────────────────────────────────
  {
    name: 'MEGALITE',
    manufacturer: 'ULMA',
    heights: ['2.70', '3.00', '3.30'],
    assembly_h_m2: 0.48,
    disassembly_h_m2: 0.14,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 490.00,
    unit: 'm2',
    description: 'Velkoformátové stěnové bednění ULMA — lehká konstrukce',
  },
  {
    name: 'COMAIN',
    manufacturer: 'ULMA',
    heights: ['1.00', '1.50', '2.00', '2.50'],
    assembly_h_m2: 0.68,
    disassembly_h_m2: 0.22,
    disassembly_ratio: 0.32,
    rental_czk_m2_month: 460.00,
    unit: 'm2',
    description: 'Rámové bednění ULMA pro základy, opěrné zdi',
  },
  {
    name: 'CC-4',
    manufacturer: 'ULMA',
    heights: ['do 6.00'],
    assembly_h_m2: 0.42,
    disassembly_h_m2: 0.13,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 370.00,
    unit: 'm2',
    description: 'Stropní bednění ULMA s hliníkovými nosníky',
  },
  // ── NOE ──────────────────────────────────────────────────────────────
  {
    name: 'NOEtop',
    manufacturer: 'NOE',
    heights: ['2.70', '3.00', '3.30'],
    assembly_h_m2: 0.52,
    disassembly_h_m2: 0.16,
    disassembly_ratio: 0.30,
    rental_czk_m2_month: 470.00,
    unit: 'm2',
    description: 'Rámové stěnové bednění NOE — jednoduché spínání',
  },
  // ── Místní ───────────────────────────────────────────────────────────
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
];

/** Find a formwork system by name */
export function findFormworkSystem(name: string): FormworkSystemSpec | undefined {
  return FORMWORK_SYSTEMS.find(s => s.name === name);
}

/** Get default formwork system (Frami Xlife) */
export function getDefaultFormworkSystem(): FormworkSystemSpec {
  return FORMWORK_SYSTEMS[0];
}
