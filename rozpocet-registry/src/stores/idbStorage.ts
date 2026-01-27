/**
 * IndexedDB Storage Adapter for Zustand persist middleware
 *
 * localStorage has a ~5MB limit which is exceeded by large projects
 * (e.g. 24 sheets × 600 items = ~15-30MB serialized).
 * IndexedDB has no practical size limit (usually 50%+ of disk space).
 *
 * Also handles one-time migration from old localStorage data.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'rozpocet-registry';
const DB_VERSION = 1;
const STORE_NAME = 'zustand';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Zustand-compatible async storage using IndexedDB
 */
export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getDB();
      const value = await db.get(STORE_NAME, name);

      // If no data in IndexedDB, check localStorage for migration
      if (value === undefined) {
        const legacyValue = localStorage.getItem(name);
        if (legacyValue) {
          // Migrate: save to IndexedDB and remove from localStorage
          await db.put(STORE_NAME, legacyValue, name);
          try {
            localStorage.removeItem(name);
          } catch {
            // Ignore if localStorage removal fails
          }
          console.log(`[idbStorage] Migrated "${name}" from localStorage to IndexedDB`);
          return legacyValue;
        }
        return null;
      }

      return value as string;
    } catch (err) {
      console.error('[idbStorage] getItem failed, falling back to localStorage:', err);
      return localStorage.getItem(name);
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, name);
    } catch (err) {
      console.error('[idbStorage] setItem failed:', err);
      // Don't fall back to localStorage - that's the problem we're solving
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, name);
    } catch (err) {
      console.error('[idbStorage] removeItem failed:', err);
    }
    // Also clean up localStorage if it exists
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore
    }
  },
};
