/**
 * STAVAGENT Unified Data Model
 *
 * Единые типы данных для всех kiosks.
 * Этот файл служит справочником — копируйте нужные типы в свои сервисы.
 *
 * @version 1.0.0
 * @created 2026-02-04
 */

// =============================================================================
// KIOSK TYPES
// =============================================================================

export type KioskType = 'portal' | 'monolit' | 'urs' | 'registry' | 'core';

export type PositionSource = 'monolit' | 'urs' | 'registry' | 'core' | 'manual';

// =============================================================================
// UNIFIED PROJECT
// =============================================================================

export interface UnifiedProject {
  /** UUID от Portal (ГЛАВНЫЙ КЛЮЧ для связи всех kiosks) */
  portalProjectId: string;

  /** Название проекта */
  name: string;

  /** Описание */
  description?: string;

  /** Статус проекта */
  status: 'active' | 'completed' | 'archived';

  /** Дата создания (ISO string) */
  createdAt: string;

  /** Дата обновления (ISO string) */
  updatedAt: string;

  /** Связи с kiosks */
  linkedKiosks: {
    /** project_id в Monolit-Planner */
    monolit?: string;
    /** job_id в URS_MATCHER */
    urs?: string;
    /** projectId в rozpocet-registry */
    registry?: string;
  };

  /** Агрегированные данные со всех kiosks */
  summary?: {
    totalPositions: number;
    totalCost: number;
    currency: 'CZK' | 'EUR';
  };
}

// =============================================================================
// UNIFIED POSITION
// =============================================================================

export interface UnifiedPosition {
  // === ИДЕНТИФИКАТОРЫ ===

  /** UUID позиции (уникальный) */
  id: string;

  /** Связь с Portal проектом */
  portalProjectId: string;

  /** Откуда пришла позиция */
  sourceKiosk: PositionSource;

  /** Оригинальный ID в источнике */
  sourceItemId: string;

  // === ОСНОВНЫЕ ПОЛЯ ===

  /**
   * Код позиции
   * - Registry: kod
   * - URS: urs_code
   * - Monolit: otskp_code
   * - CORE: code
   */
  code: string | null;

  /**
   * Описание работы
   * - Registry: popis
   * - URS: urs_name
   * - Monolit: item_name
   * - CORE: description
   */
  description: string;

  /**
   * Количество
   * - Registry: mnozstvi
   * - URS: quantity
   * - Monolit: qty
   * - CORE: quantity
   */
  quantity: number | null;

  /**
   * Единица измерения
   * - Registry: mj
   * - Others: unit
   */
  unit: string | null;

  /**
   * Цена за единицу
   * - Registry: cenaJednotkova
   * - Monolit: unit_cost_native
   * - CORE: unit_price
   */
  unitPrice: number | null;

  /**
   * Общая сумма
   * - Registry: cenaCelkem
   * - Monolit: kros_total_czk
   * - CORE: total_price
   */
  totalPrice: number | null;

  // === КЛАССИФИКАЦИЯ ===

  /**
   * Группа/тип работы
   * - Registry: skupina (ZEMNI_PRACE, BETON_MONOLIT, etc.)
   * - Monolit: subtype (beton, bednění, výztuž, jiné)
   * - CORE: category
   */
  category: string | null;

  /**
   * Роль строки в иерархии
   */
  rowRole: 'main' | 'section' | 'subordinate' | 'unknown';

  // === КАЧЕСТВО ДАННЫХ ===

  /** Уверенность классификации (0-100) */
  confidence: number | null;

  /** Откуда получен код/классификация */
  matchSource: 'ai' | 'manual' | 'rule' | 'catalog' | null;

  // === TOV (ВЕДОМОСТЬ РЕСУРСОВ) ===

  /** Связанная ведомость ресурсов */
  tov?: TOVData;

  // === ИСТОЧНИК ===

  source: {
    /** Имя файла импорта */
    fileName?: string;
    /** Имя листа Excel */
    sheetName?: string;
    /** Номер строки */
    rowNumber?: number;
    /** Дата импорта */
    importedAt: string;
  };

  // === СВЯЗИ С КАЛЬКУЛЯТОРАМИ ===

  linkedCalculations?: {
    /** ID позиции в Monolit */
    monolitPositionId?: string;
    /** ID матча в URS */
    ursMatchId?: string;
  };
}

// =============================================================================
// TOV (ВЕДОМОСТЬ РЕСУРСОВ)
// =============================================================================

export interface TOVData {
  /** Трудовые ресурсы */
  labor: LaborResource[];

  /** Итоги по труду */
  laborSummary: {
    totalNormHours: number;
    totalWorkers: number;
    totalCost: number;
  };

  /** Механизмы */
  machinery: MachineryResource[];

  /** Итоги по технике */
  machinerySummary: {
    totalMachineHours: number;
    totalUnits: number;
    totalCost: number;
  };

  /** Материалы */
  materials: MaterialResource[];

  /** Итоги по материалам */
  materialsSummary: {
    totalCost: number;
    itemCount: number;
  };

  /** Общие итоги */
  grandTotal: {
    totalCost: number;
    currency: 'CZK';
  };
}

// =============================================================================
// РЕСУРСЫ
// =============================================================================

export interface LaborResource {
  /** UUID ресурса */
  id: string;

  /** Профессия (бетонщик, арматурщик, опалубщик) */
  profession: string;

  /** Код профессии (опционально) */
  professionCode?: string;

  /** Количество рабочих */
  count: number;

  /** Часы на единицу работы */
  hours: number;

  /** Норм-часы (count × hours) */
  normHours: number;

  /** Ставка Kč/час */
  hourlyRate?: number;

  /** Общая стоимость (normHours × hourlyRate) */
  totalCost?: number;

  /** Ссылка на калькулятор (будущее) */
  linkedCalcId?: string;
  linkedCalcType?: 'labor_calc';
}

export interface MachineryResource {
  /** UUID ресурса */
  id: string;

  /** Тип техники (автобетононасос, кран, вибратор) */
  type: string;

  /** Код техники */
  typeCode?: string;

  /** Количество единиц */
  count: number;

  /** Часы работы */
  hours: number;

  /** Машино-часы (count × hours) */
  machineHours: number;

  /** Ставка Kč/час */
  hourlyRate?: number;

  /** Общая стоимость */
  totalCost?: number;

  /** Ссылка на калькулятор (будущее) */
  linkedCalcId?: string;
  linkedCalcType?: 'machinery_calc';
}

export interface MaterialResource {
  /** UUID ресурса */
  id: string;

  /** Название материала (Бетон C30/37, арматура B500B) */
  name: string;

  /** Код материала */
  code?: string;

  /** Количество */
  quantity: number;

  /** Единица измерения (m³, kg, ks) */
  unit: string;

  /** Цена за единицу */
  unitPrice?: number;

  /** Общая стоимость */
  totalCost?: number;

  /** Ссылка на калькулятор */
  linkedCalcId?: string;
  linkedCalcType?: 'monolit' | 'material_calc';
}

// =============================================================================
// МАППИНГ ФУНКЦИИ (ШАБЛОНЫ)
// =============================================================================

/**
 * Маппинг из Registry в Unified
 *
 * Использование в rozpocet-registry:
 * ```typescript
 * import { mapRegistryToUnified } from './mapping';
 * const unified = mapRegistryToUnified(item, portalProjectId);
 * ```
 */
export function mapRegistryToUnified(
  item: {
    id: string;
    kod: string | null;
    popis: string;
    mnozstvi: number | null;
    mj: string | null;
    cenaJednotkova: number | null;
    cenaCelkem: number | null;
    skupina: string | null;
    rowRole?: string;
    source?: { fileName?: string; sheetName?: string; rowNumber?: number };
  },
  portalProjectId: string
): UnifiedPosition {
  return {
    id: crypto.randomUUID(),
    portalProjectId,
    sourceKiosk: 'registry',
    sourceItemId: item.id,
    code: item.kod,
    description: item.popis,
    quantity: item.mnozstvi,
    unit: item.mj,
    unitPrice: item.cenaJednotkova,
    totalPrice: item.cenaCelkem,
    category: item.skupina,
    rowRole: (item.rowRole as any) || 'unknown',
    confidence: null,
    matchSource: null,
    source: {
      fileName: item.source?.fileName,
      sheetName: item.source?.sheetName,
      rowNumber: item.source?.rowNumber,
      importedAt: new Date().toISOString(),
    },
  };
}

/**
 * Маппинг из Monolit в Unified
 *
 * Использование в Monolit-Planner:
 * ```typescript
 * import { mapMonolitToUnified } from './mapping';
 * const unified = mapMonolitToUnified(position, portalProjectId);
 * ```
 */
export function mapMonolitToUnified(
  position: {
    id: string;
    otskp_code?: string;
    item_name?: string;
    part_name: string;
    qty: number;
    unit: string;
    unit_cost_native?: number;
    kros_total_czk?: number;
    subtype: string;
  },
  portalProjectId: string
): UnifiedPosition {
  return {
    id: crypto.randomUUID(),
    portalProjectId,
    sourceKiosk: 'monolit',
    sourceItemId: position.id,
    code: position.otskp_code || null,
    description: position.item_name || position.part_name,
    quantity: position.qty,
    unit: position.unit,
    unitPrice: position.unit_cost_native || null,
    totalPrice: position.kros_total_czk || null,
    category: position.subtype,
    rowRole: 'main',
    confidence: null,
    matchSource: null,
    source: {
      importedAt: new Date().toISOString(),
    },
  };
}

/**
 * Маппинг из URS в Unified
 *
 * Использование в URS_MATCHER:
 * ```typescript
 * import { mapURSToUnified } from './mapping';
 * const unified = mapURSToUnified(match, portalProjectId);
 * ```
 */
export function mapURSToUnified(
  match: {
    id: string;
    urs_code: string;
    urs_name: string;
    quantity?: number;
    unit?: string;
    confidence: number;
  },
  portalProjectId: string
): UnifiedPosition {
  return {
    id: crypto.randomUUID(),
    portalProjectId,
    sourceKiosk: 'urs',
    sourceItemId: match.id,
    code: match.urs_code,
    description: match.urs_name,
    quantity: match.quantity || null,
    unit: match.unit || null,
    unitPrice: null,
    totalPrice: null,
    category: null,
    rowRole: 'main',
    confidence: match.confidence,
    matchSource: 'ai',
    source: {
      importedAt: new Date().toISOString(),
    },
  };
}

// =============================================================================
// API CONTRACTS
// =============================================================================

/** Запрос на импорт позиций */
export interface ImportPositionsRequest {
  portalProjectId: string;
  positions: UnifiedPosition[];
  source: PositionSource;
  mergeStrategy: 'append' | 'replace' | 'merge';
}

/** Ответ на импорт */
export interface ImportPositionsResponse {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
}

/** Запрос на экспорт */
export interface ExportPositionsRequest {
  portalProjectId: string;
  format: 'unified' | 'excel' | 'json';
  includeT OV?: boolean;
}

/** Ответ на экспорт */
export interface ExportPositionsResponse {
  portalProjectId: string;
  positions: UnifiedPosition[];
  exportedAt: string;
  totalCount: number;
}

/** Межкиосковое сообщение */
export interface KioskMessage {
  type: 'POSITION_EXPORT' | 'CALCULATION_RESULT' | 'SYNC_REQUEST' | 'LINK_PROJECT';
  source: KioskType;
  target: KioskType;
  portalProjectId: string;
  payload: any;
  timestamp: string;
  messageId: string;
}
