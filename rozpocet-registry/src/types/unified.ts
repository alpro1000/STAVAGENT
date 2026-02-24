/**
 * Rozpočet Registry - Unified Types
 *
 * Shared data model for inter-kiosk communication in STAVAGENT ecosystem.
 * All kiosks (Registry, Monolit, URS Matcher) use these interfaces
 * for data exchange through Portal.
 *
 * @see docs/UNIFICATION_PLAN.md
 */

// ============================================================================
// KIOSK TYPES
// ============================================================================

export type KioskType = 'monolit' | 'urs' | 'registry' | 'core' | 'manual';

// ============================================================================
// UNIFIED PROJECT
// ============================================================================

export interface UnifiedProject {
  /** UUID от Portal (ГЛАВНЫЙ КЛЮЧ) */
  portalProjectId: string;
  /** Название проекта */
  name: string;
  /** Описание */
  description?: string;

  /** Статус проекта */
  status: 'active' | 'completed' | 'archived';
  /** ISO datetime */
  createdAt: string;
  /** ISO datetime */
  updatedAt: string;

  /** Связи с kiosks */
  linkedKiosks: {
    monolit?: string;     // project_id в Monolit
    urs?: string;         // job_id в URS
    registry?: string;    // projectId в Registry
  };

  /** Агрегированные данные */
  summary?: {
    totalPositions: number;
    totalCost: number;
    currency: 'CZK';
  };
}

// ============================================================================
// UNIFIED POSITION
// ============================================================================

export interface UnifiedPosition {
  // === ИДЕНТИФИКАТОРЫ ===
  /** UUID позиции (уникальный) */
  id: string;
  /** Связь с Portal проектом */
  portalProjectId: string;
  /** Источник данных */
  sourceKiosk: KioskType;
  /** Оригинальный ID в источнике */
  sourceItemId: string;

  // === ОСНОВНЫЕ ПОЛЯ (ЕДИНОЕ ИМЕНОВАНИЕ) ===
  /**
   * Код позиции
   * - kod (registry)
   * - urs_code (urs)
   * - otskp_code (monolit)
   * - code (core)
   */
  code: string | null;

  /**
   * Описание работы
   * - popis (registry)
   * - urs_name (urs)
   * - item_name (monolit)
   * - description (core)
   */
  description: string;

  /**
   * Количество
   * - mnozstvi (registry)
   * - quantity (urs, core)
   * - qty (monolit)
   */
  quantity: number | null;

  /**
   * Единица измерения
   * - mj (registry)
   * - unit (все остальные)
   */
  unit: string | null;

  /**
   * Цена за единицу
   * - cenaJednotkova (registry)
   * - unit_cost_native (monolit)
   * - unit_price (core)
   */
  unitPrice: number | null;

  /**
   * Общая сумма
   * - cenaCelkem (registry)
   * - kros_total_czk (monolit)
   * - total_price (core)
   */
  totalPrice: number | null;

  // === КЛАССИФИКАЦИЯ ===
  /**
   * Группа/тип работы
   * - skupina (registry)
   * - subtype (monolit)
   * - category (core)
   */
  category: string | null;

  /** Роль строки */
  rowRole: 'main' | 'section' | 'subordinate' | 'unknown';

  // === КАЧЕСТВО ДАННЫХ ===
  /** 0-100, уверенность классификации */
  confidence: number | null;
  /** Откуда получен код (AI, manual, rule) */
  matchSource: string | null;

  // === TOV (ВЕДОМОСТЬ РЕСУРСОВ) ===
  tov?: TOVData;

  // === ИСТОЧНИК ===
  source: {
    fileName?: string;
    sheetName?: string;
    rowNumber?: number;
    importedAt: string;
  };

  // === СВЯЗИ ===
  linkedCalculations?: {
    /** Ссылка на расчёт в Monolit */
    monolitPositionId?: string;
    /** Ссылка на матч в URS */
    ursMatchId?: string;
  };
}

// ============================================================================
// TOV (ВЕДОМОСТЬ РЕСУРСОВ)
// ============================================================================

/**
 * FormworkRentalRow — one construction element in the formwork rental table
 * Matches the user's spreadsheet structure exactly:
 * Konstrukce | m2 | Sada | taktů | sad | dní/takt | Doba bednění | beton/takt | Celkem beton | Celková | Měsíční/sada | Konečný nájem | Systém | Výška | Kč/m2
 */
export interface FormworkRentalRow {
  id: string;
  construction_name: string;       // Konstrukce (e.g. "SO202 Základ OP")
  celkem_m2: number;               // Celkem [m2] — total formwork area
  sada_m2: number;                 // Sada [m2] — one set area
  pocet_taktu: number;             // Množství taktů [kus]
  pocet_sad: number;               // Množství sad [kus] — usually 1 or 2
  dni_na_takt: number;             // počet dní na takt (zřízení+odstranění)
  dni_beton_takt: number;          // Doba beton+výztuž+zrání na 1 takt [den]
  // Computed (stored for display):
  doba_bedneni: number;            // = (takty/sady) × dní_na_takt
  celkem_beton: number;            // = (takty/sady) × dní_beton_takt
  celkova_doba: number;            // = doba_bedneni + celkem_beton
  // Formwork system:
  bednici_system: string;          // Bednící systém (Frami Xlife, Framax...)
  rozmery: string;                 // Rozměry / Výška bednění (h= 0,9 m)
  mesicni_najem_jednotka: number;  // Měsíční nájem [Kč/m²]
  // Computed:
  mesicni_najem_sada: number;      // = sada_m2 × mesicni_najem_jednotka
  konecny_najem: number;           // = mesicni_najem_sada × (celkova_doba/30) × pocet_sad
  // KROS:
  kros_kod?: string;
  kros_popis?: string;             // Auto-generated description
}

/**
 * PumpConstructionItem — one construction element in the pump calculator.
 * Tracks volume per takt, mobilizations, and computed billing hours.
 */
export interface PumpConstructionItem {
  id: string;
  nazev: string;                   // Betonáž základové desky / pilotů...
  objem_m3_takt: number;           // m³ concrete per takt
  pocet_taktu: number;             // number of construction cycles
  pocet_pristaveni: number;        // number of pump mobilizations for this element
  // computed (re-calculated when pump type changes):
  celkem_m3: number;               // = objem_m3_takt × pocet_taktu
  hodiny_cerpani: number;          // = celkem_m3 / vykon_m3h
  hodiny_overhead: number;         // = pocet_pristaveni × (stavba_h + myti_h)
  hodiny_celkem: number;           // = hodiny_cerpani + hodiny_overhead
}

/**
 * PumpSurcharge — additional custom charge per pump mobilization.
 * e.g. příplatek za víkend, noční provoz, čekání.
 */
export interface PumpSurcharge {
  id: string;
  nazev: string;                   // Name of the surcharge
  czk_per_pristaveni: number;      // CZK per mobilization
  // computed:
  celkem: number;                  // = czk_per_pristaveni × celkem_pristaveni
}

/**
 * PumpAccessory — optional accessory charge (příslušenství).
 * e.g. gumová hadice (Kč/m), drátkobetonová (Kč/m³).
 */
export interface PumpAccessory {
  id: string;
  nazev: string;                   // Gumová hadice, Ocelové potrubí...
  mnozstvi: number;                // Length in m, volume in m³, or count
  unit: string;                    // "m", "m³", "ks"
  czk_per_unit: number;            // From knowledge base or custom
  // computed:
  celkem: number;                  // = mnozstvi × czk_per_unit
}

/**
 * PumpRentalData — full concrete pump calculator state.
 * Realistic pricing model based on Czech supplier offers (betonárka).
 *
 * Cost formula:
 *   Doprava     = přistavení × (pristaveni_fixed + km × czk_km × 2)
 *   Manipulace  = manipulace_czk_h × Σ hodiny_celkem_per_item
 *   Příplatek   = priplatek_czk_m3 × celkem_m3  (0 for small pumps)
 *   Příslušenství = Σ accessories
 *   Příplatky   = Σ surcharges × celkem_pristaveni
 *   ──────────────────────────────────────────────
 *   Konečná cena = součet všeho výše
 *
 * Standard times (per přistavení, per Beton Union):
 *   0.5 h stavba + 0.5 h mytí = 1 h overhead billed at manipulace_czk_h
 */
export interface PumpRentalData {
  // ── Pump type (from pump_knowledge.json) ──────────────────────────────────
  pump_type_id?: string;           // e.g. "bu_28_24"
  pump_label?: string;             // e.g. "28/24 m (Boom 28 m)"

  // ── Pump parameters (auto-filled from knowledge base, but editable) ───────
  manipulace_czk_h: number;        // Hourly rate on site [Kč/h]
  priplatek_czk_m3: number;        // Per-m³ surcharge (0 for small pumps) [Kč/m³]
  pristaveni_fixed_czk: number;    // Fixed mobilization cost at plant [Kč]
  czk_km: number;                  // Per km (one way) — calc uses × 2 [Kč/km]
  vykon_m3h: number;               // Pump capacity for auto-computing hours [m³/h]

  // ── Transport ──────────────────────────────────────────────────────────────
  vzdalenost_km: number;           // Distance from concrete plant [km, one way]

  // ── Standard overhead times (per přistavení) ──────────────────────────────
  stavba_h: number;                // Setup time per mobilization [h], default 0.5
  myti_h: number;                  // Cleanup time per mobilization [h], default 0.5

  // ── Construction elements ──────────────────────────────────────────────────
  items: PumpConstructionItem[];

  // ── Accessories (příslušenství) ────────────────────────────────────────────
  accessories: PumpAccessory[];

  // ── Custom surcharges (příplatky) ─────────────────────────────────────────
  surcharges: PumpSurcharge[];

  // ── KROS ──────────────────────────────────────────────────────────────────
  kros_kod?: string;

  // ── Computed totals (stored for display & export) ─────────────────────────
  celkem_m3: number;               // Total concrete volume
  celkem_pristaveni: number;       // Total pump mobilizations
  celkem_hodiny: number;           // Total billing hours (Σ hodiny_celkem)
  celkem_doprava: number;          // n × (pristaveni_fixed + km × czk_km × 2)
  celkem_manipulace: number;       // manipulace_czk_h × celkem_hodiny
  celkem_priplatek_m3: number;     // priplatek_czk_m3 × celkem_m3
  celkem_prislusenstvi: number;    // Σ accessories.celkem
  celkem_priplatky: number;        // Σ surcharges.celkem
  konecna_cena: number;            // Grand total
}

export interface TOVData {
  // === ТРУДОВЫЕ РЕСУРСЫ ===
  labor: LaborResource[];
  laborSummary: {
    /** Сумма норм-часов */
    totalNormHours: number;
    /** Всего рабочих */
    totalWorkers: number;
  };

  // === МЕХАНИЗМЫ ===
  machinery: MachineryResource[];
  machinerySummary: {
    /** Сумма машино-часов */
    totalMachineHours: number;
    /** Всего единиц техники */
    totalUnits: number;
  };

  // === МАТЕРИАЛЫ ===
  materials: MaterialResource[];
  materialsSummary: {
    /** Сумма стоимости материалов */
    totalCost: number;
    /** Количество наименований */
    itemCount: number;
  };

  // === NÁJEM BEDNĚNÍ (only for BEDNENI positions) ===
  formworkRental?: FormworkRentalRow[];

  // === KALKULÁTOR BETONOČERPADLA (only for BETON_MONOLIT / BETON_PREFAB) ===
  pumpRental?: PumpRentalData;
}

export interface LaborResource {
  id: string;
  /** бетонщик, арматурщик, опалубщик */
  profession: string;
  /** Код профессии */
  professionCode?: string;
  /** Количество рабочих */
  count: number;
  /** Часы на единицу */
  hours: number;
  /** count × hours = норм-часы */
  normHours: number;
  /** Ставка Kč/час */
  hourlyRate?: number;
  /** normHours × hourlyRate */
  totalCost?: number;
  /** Ссылка на калькулятор (будущее) */
  linkedCalcId?: string;
}

export interface MachineryResource {
  id: string;
  /** автобетононасос, кран, вибратор */
  type: string;
  /** Код техники */
  typeCode?: string;
  /** Количество единиц */
  count: number;
  /** Часы работы */
  hours: number;
  /** count × hours = машино-часы */
  machineHours: number;
  /** Ставка Kč/час */
  hourlyRate?: number;
  totalCost?: number;
  /** Ссылка на калькулятор (будущее) */
  linkedCalcId?: string;
}

export interface MaterialResource {
  id: string;
  /** Бетон C30/37, арматура B500B */
  name: string;
  /** Код материала */
  code?: string;
  /** Количество */
  quantity: number;
  /** m³, kg, ks */
  unit: string;
  /** Цена за единицу */
  unitPrice?: number;
  /** quantity × unitPrice */
  totalCost?: number;
  /** Ссылка на Monolit для бетона */
  linkedCalcId?: string;
  linkedCalcType?: 'monolit' | 'future_material_calc';
}

// ============================================================================
// SYNC API TYPES
// ============================================================================

export type MergeStrategy = 'append' | 'replace' | 'merge';

export interface ImportPositionsRequest {
  portalProjectId: string;
  positions: UnifiedPosition[];
  source: KioskType;
  mergeStrategy: MergeStrategy;
}

export interface ImportPositionsResponse {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
}

export interface ExportPositionsResponse {
  portalProjectId: string;
  positions: UnifiedPosition[];
  exportedAt: string;
}

// ============================================================================
// INTER-KIOSK COMMUNICATION
// ============================================================================

export interface KioskMessage {
  type: 'POSITION_EXPORT' | 'CALCULATION_RESULT' | 'SYNC_REQUEST';
  source: KioskType;
  target: KioskType;
  portalProjectId: string;
  payload: unknown;
  timestamp: string;
}
