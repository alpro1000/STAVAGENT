/**
 * Rozpočet Registry - Constants
 * Predefined work groups (single source of truth, used by both frontend and serverless).
 * Version: 3.0.0 - Diacritics corrected, frontend+serverless unified (2026-04-26)
 */

export const DEFAULT_GROUPS = [
  'ZEMNÍ_PRÁCE',        // Earthworks (výkopy, hloubení, pažení, čerpání vody)
  'BETON_MONOLIT',      // Cast-in-place concrete (betonáž, monolit, železobeton)
  'BETON_PREFAB',       // Precast concrete (obrubníky, dílce, prefabrikát)
  'VÝZTUŽ',             // Reinforcement (výztuž, armatura, kari, B500)
  'KOTVENÍ',            // Anchoring (kotvy, injektáž, tyčové/lanové)
  'BEDNĚNÍ',            // Formwork (bednění, systémové, tvarové)
  'PILOTY',             // Piles (piloty, mikropiloty, vrtané)
  'IZOLACE',            // Insulation (hydroizolace, geotextilie, fólie, nátěry)
  'KOMUNIKACE',         // Roads (vozovka, asfalt, chodník, dlažba)
  'DOPRAVA',            // Transportation (doprava betonu, odvoz zeminy)
  'LOŽISKA',            // Bearings (ložisko, ložiska, kalotové, kyvné)
] as const;

export type WorkGroup = typeof DEFAULT_GROUPS[number];

export const CLASSIFICATION_PRIORITY = {
  ABSOLUTE: 200,   // Overrides all other groups (PILOTY)
  VERY_HIGH: 120,  // For conflict resolution (KOTVENÍ vs VÝZTUŽ)
  HIGH: 100,
  MEDIUM: 50,
  LOW: 10,
} as const;
