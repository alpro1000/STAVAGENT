/**
 * Rozpočet Registry - Constants
 * Predefined work groups and other constants
 */

export const DEFAULT_GROUPS = [
  // Zemní práce
  'Zemní práce',
  'Výkopy',
  'Násypy',

  // Základy
  'Základy',
  'Piloty',
  'Mikropiloty',
  'Štětovnice',

  // Betonové práce
  'Beton - základy',
  'Beton - spodní stavba',
  'Beton - nosná konstrukce',
  'Beton - mostovka',
  'Beton - ostatní',

  // Výztuž
  'Výztuž',
  'Předpínací výztuž',

  // Bednění
  'Bednění',

  // Mostní prvky
  'Mostní ložiska',
  'Mostní závěry',
  'Mostní odvodňovače',
  'Zábradlí',
  'Svodidla',
  'Římsy',

  // Izolace
  'Izolace',
  'Hydroizolace',

  // Zkoušky
  'Zkoušky',
  'Geodézie',

  // Ostatní
  'Demolice',
  'Přeložky IS',
  'Dopravní značení',
  'Ostatní',
] as const;

export type WorkGroup = typeof DEFAULT_GROUPS[number];

export const CLASSIFICATION_PRIORITY = {
  HIGH: 100,
  MEDIUM: 50,
  LOW: 10,
} as const;
