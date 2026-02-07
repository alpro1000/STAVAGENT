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
