/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: kb/tkp18_maturity.yaml
 * Regenerate: npm run gen:knowledge
 */

/** Per-row entry of CURING_DAYS_TABLE. */
export interface CuringDaysRow {
  temp_min: number;
  temp_max: number;
  description?: string;
  /** class group key → curing class key (as string) → days. */
  days: Record<string, Record<string, number>>;
}

/** ČSN EN 13670 Table NA.2 + TKP18 §7.8.3 — curing days by temp range × class group × curing class. */
export const CURING_DAYS_TABLE: CuringDaysRow[] = [{"temp_min":-5,"temp_max":5,"description":"t < 5°C — very slow hydration","days":{"C12-C16":{"2":7,"3":12,"4":22},"C20-C25":{"2":5,"3":9,"4":18},"C30+":{"2":4,"3":7,"4":30}}},{"temp_min":5,"temp_max":10,"description":"5°C ≤ t < 10°C","days":{"C12-C16":{"2":5,"3":9,"4":18},"C20-C25":{"2":4,"3":7,"4":13},"C30+":{"2":3,"3":5,"4":18}}},{"temp_min":10,"temp_max":15,"description":"10°C ≤ t < 15°C","days":{"C12-C16":{"2":4,"3":7,"4":13},"C20-C25":{"2":3,"3":5,"4":9},"C30+":{"2":2,"3":4,"4":13}}},{"temp_min":15,"temp_max":25,"description":"15°C ≤ t < 25°C — optimal range","days":{"C12-C16":{"2":3,"3":5,"4":10},"C20-C25":{"2":2,"3":4,"4":9},"C30+":{"2":1.5,"3":2.5,"4":9}}},{"temp_min":25,"temp_max":50,"description":"t ≥ 25°C — fast but mandatory wet curing","days":{"C12-C16":{"2":2,"3":3.5,"4":7},"C20-C25":{"2":1.5,"3":2.5,"4":5},"C30+":{"2":1,"3":1.5,"4":5}}}];

/** TKP18 §7.8.3 hard minimums per exposure class (XF, XD, XS, XA series). */
export const EXPOSURE_MIN_CURING_DAYS: Record<string, number> = {"XF1":5,"XF2":5,"XF3":7,"XF4":7,"XD2":5,"XD3":7,"XS2":5,"XS3":7,"XA2":5,"XA3":7};

/** TKP18 absolute minimum for PK (pozemní komunikace) bridge elements. */
export const TKP18_ABSOLUTE_MIN_DAYS = 5;

/** Cement type speed factor (relative to CEM I = 1.0). */
export const CEMENT_SPEED: Record<'CEM_I' | 'CEM_II' | 'CEM_III', number> = {"CEM_I":1,"CEM_II":0.85,"CEM_III":0.6};

/** Datum temperature for Nurse-Saul maturity (°C). */
export const T_DATUM = -10;

/** Default curing class per element type per TKP18 §7.8.3 (2=foundations, 3=substructure, 4=superstructure). */
export const DEFAULT_CURING_CLASS_BY_ELEMENT: Record<string, 2 | 3 | 4> = {"mostovkova_deska":4,"rimsa":4,"rigel":4,"opery_ulozne_prahy":3,"driky_piliru":3,"zaklady_piliru":3,"kridla_opery":3,"mostni_zavirne_zidky":3,"podlozkovy_blok":3,"operne_zdi":3};

/** ZDS exception per §7.8.3.4 — default 5d, 7d pro XF3/XF4. */
export const ZDS_EXCEPTION = {"default_days":5,"xf3_xf4_days":7,"description":"ZDS exception — default 5d, raise to 7d pro XF3/XF4","temperature_kropit_range_c":[5,20],"temperature_no_kropit_below_c":5} as const;

/** Source citation for audit trail. */
export const SOURCE_CITATION = {"norm":"ČSN EN 13670 Table NA.2 + TKP18 §7.8.3","also_see":"ČSN EN 206+A2, ČSN 73 6244","pdf_reference":"https://pjpk.rsd.cz/data/USR_001_2_8_TKP/TKP_18_06_2025.pdf","extracted_from":["concrete-agent/packages/core-backend/app/knowledge_base/B2_csn_standards/tkp/tkp_18_betonove_mosty.json","Monolit-Planner/shared/src/calculators/maturity.ts (CURING_DAYS_TABLE constant)"],"extraction_date":"2026-05-26"} as const;
