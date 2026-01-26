/**
 * Rozpočet Registry - Constants
 * Predefined work groups (migrated from Python classifier)
 * Version: 2.0.0 - Rule-based classifier (2026-01-26)
 */

export const DEFAULT_GROUPS = [
  'ZEMNI_PRACE',        // Earthworks (výkopy, hloubení, pažení, čerpání vody)
  'BETON_MONOLIT',      // Cast-in-place concrete (betonáž, monolit, železobeton)
  'BETON_PREFAB',       // Precast concrete (obrubníky, dílce, prefabrikát)
  'VYZTUŽ',             // Reinforcement (výztuž, armatura, kari, B500)
  'KOTVENI',            // Anchoring (kotvy, injektáž, tyčové/lanové)
  'BEDNENI',            // Formwork (bednění, systémové, tvarové)
  'PILOTY',             // Piles (piloty, mikropiloty, vrtané)
  'IZOLACE',            // Insulation (hydroizolace, geotextilie, fólie)
  'KOMUNIKACE',         // Roads (vozovka, asfalt, chodník, dlažba)
  'DOPRAVA',            // Transportation (doprava betonu, odvoz zeminy)
] as const;

export type WorkGroup = typeof DEFAULT_GROUPS[number];

export const CLASSIFICATION_PRIORITY = {
  VERY_HIGH: 120,  // For conflict resolution (KOTVENI vs VYZTUŽ)
  HIGH: 100,
  MEDIUM: 50,
  LOW: 10,
} as const;
