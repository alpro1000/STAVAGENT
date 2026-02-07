/**
 * Mapping Store
 * Хранение маппингов проектов в IndexedDB
 *
 * Хранит только маппинг, не данные!
 * Данные читаются напрямую из Excel при каждом открытии.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { ProjectMapping, ItemMapping } from './excelMapper';

const DB_NAME = 'rozpocet-registry-mappings';
const DB_VERSION = 1;
const MAPPINGS_STORE = 'project-mappings';
const PRICES_STORE = 'price-updates';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Маппинги проектов
        if (!db.objectStoreNames.contains(MAPPINGS_STORE)) {
          db.createObjectStore(MAPPINGS_STORE);
        }
        // История обновлений цен (опционально)
        if (!db.objectStoreNames.contains(PRICES_STORE)) {
          const pricesStore = db.createObjectStore(PRICES_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          pricesStore.createIndex('by-project', 'projectId');
          pricesStore.createIndex('by-row', ['projectId', 'row']);
        }
      },
    });
  }
  return dbPromise;
}

// ============================================
// PROJECT MAPPINGS
// ============================================

/**
 * Сохранить маппинг проекта
 */
export async function saveProjectMapping(mapping: ProjectMapping): Promise<void> {
  try {
    const db = await getDB();
    const updated = { ...mapping, updatedAt: new Date() };
    await db.put(MAPPINGS_STORE, updated, mapping.projectId);
    console.log(`[MappingStore] Saved mapping for project ${mapping.projectId}`);
  } catch (err) {
    console.error('[MappingStore] Failed to save mapping:', err);
    throw err;
  }
}

/**
 * Получить маппинг проекта
 */
export async function getProjectMapping(projectId: string): Promise<ProjectMapping | null> {
  try {
    const db = await getDB();
    const mapping = await db.get(MAPPINGS_STORE, projectId);
    return mapping || null;
  } catch (err) {
    console.error('[MappingStore] Failed to get mapping:', err);
    return null;
  }
}

/**
 * Обновить маппинг позиции (например, после классификации)
 */
export async function updateItemMapping(
  projectId: string,
  row: number,
  updates: Partial<ItemMapping>
): Promise<void> {
  try {
    const mapping = await getProjectMapping(projectId);
    if (!mapping) {
      throw new Error(`Маппинг для проекта ${projectId} не найден`);
    }

    const itemIndex = mapping.items.findIndex(i => i.row === row);
    if (itemIndex === -1) {
      // Добавляем новую позицию
      mapping.items.push({
        row,
        itemId: updates.itemId || `item_${projectId}_${row}`,
        skupina: updates.skupina || null,
      });
    } else {
      // Обновляем существующую
      mapping.items[itemIndex] = { ...mapping.items[itemIndex], ...updates };
    }

    await saveProjectMapping(mapping);
  } catch (err) {
    console.error('[MappingStore] Failed to update item mapping:', err);
    throw err;
  }
}

/**
 * Удалить маппинг проекта
 */
export async function deleteProjectMapping(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(MAPPINGS_STORE, projectId);
    console.log(`[MappingStore] Deleted mapping for project ${projectId}`);
  } catch (err) {
    console.error('[MappingStore] Failed to delete mapping:', err);
  }
}

/**
 * Получить все маппинги
 */
export async function getAllProjectMappings(): Promise<ProjectMapping[]> {
  try {
    const db = await getDB();
    return await db.getAll(MAPPINGS_STORE);
  } catch (err) {
    console.error('[MappingStore] Failed to get all mappings:', err);
    return [];
  }
}

// ============================================
// PRICE UPDATES (История изменений)
// ============================================

export interface PriceUpdateRecord {
  id?: number;
  projectId: string;
  row: number;
  unitPrice: number;
  source: 'USER' | 'TOV' | 'AI_SUGGESTED' | 'SUPPLIER' | 'URS_NORM';
  updatedAt: Date;
}

/**
 * Записать обновление цены в историю
 */
export async function recordPriceUpdate(record: Omit<PriceUpdateRecord, 'id' | 'updatedAt'>): Promise<void> {
  try {
    const db = await getDB();
    await db.add(PRICES_STORE, {
      ...record,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error('[MappingStore] Failed to record price update:', err);
    // Не бросаем ошибку - это некритично
  }
}

/**
 * Получить историю цен для позиции
 */
export async function getPriceHistory(projectId: string, row: number): Promise<PriceUpdateRecord[]> {
  try {
    const db = await getDB();
    const tx = db.transaction(PRICES_STORE, 'readonly');
    const index = tx.store.index('by-row');
    return await index.getAll([projectId, row]);
  } catch (err) {
    console.error('[MappingStore] Failed to get price history:', err);
    return [];
  }
}

/**
 * Получить последние цены для проекта (для восстановления)
 */
export async function getLatestPrices(projectId: string): Promise<Map<number, number>> {
  try {
    const db = await getDB();
    const tx = db.transaction(PRICES_STORE, 'readonly');
    const index = tx.store.index('by-project');
    const records = await index.getAll(projectId);

    // Берём последнюю цену для каждой строки
    const priceMap = new Map<number, number>();
    records.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    for (const record of records) {
      priceMap.set(record.row, record.unitPrice);
    }

    return priceMap;
  } catch (err) {
    console.error('[MappingStore] Failed to get latest prices:', err);
    return new Map();
  }
}

/**
 * Очистить историю цен для проекта
 */
export async function clearPriceHistory(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(PRICES_STORE, 'readwrite');
    const index = tx.store.index('by-project');
    const keys = await index.getAllKeys(projectId);

    for (const key of keys) {
      await tx.store.delete(key);
    }

    await tx.done;
    console.log(`[MappingStore] Cleared price history for project ${projectId}`);
  } catch (err) {
    console.error('[MappingStore] Failed to clear price history:', err);
  }
}
