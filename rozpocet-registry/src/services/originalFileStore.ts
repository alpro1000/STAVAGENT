/**
 * Original File Store
 * Stores original Excel files in IndexedDB for "return to original" export.
 *
 * Separate from Zustand store because:
 * 1. ArrayBuffers don't serialize well to JSON
 * 2. Large files should be stored directly in IndexedDB
 * 3. We don't need reactivity for binary data
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'rozpocet-registry-files';
const DB_VERSION = 1;
const STORE_NAME = 'original-files';

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

export interface OriginalFileData {
  fileName: string;
  fileData: ArrayBuffer;
  storedAt: Date;
}

/**
 * Store original file data for a project
 */
export async function storeOriginalFile(
  projectId: string,
  fileName: string,
  fileData: ArrayBuffer
): Promise<void> {
  try {
    const db = await getDB();
    const data: OriginalFileData = {
      fileName,
      fileData,
      storedAt: new Date(),
    };
    await db.put(STORE_NAME, data, projectId);
    console.log(`[OriginalFileStore] Stored original file for project ${projectId}: ${fileName}`);
  } catch (err) {
    console.error('[OriginalFileStore] Failed to store original file:', err);
    throw err;
  }
}

/**
 * Get original file data for a project
 */
export async function getOriginalFile(projectId: string): Promise<OriginalFileData | null> {
  try {
    const db = await getDB();
    const data = await db.get(STORE_NAME, projectId);
    return data || null;
  } catch (err) {
    console.error('[OriginalFileStore] Failed to get original file:', err);
    return null;
  }
}

/**
 * Check if original file exists for a project
 */
export async function hasOriginalFile(projectId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const data = await db.get(STORE_NAME, projectId);
    return !!data;
  } catch (err) {
    console.error('[OriginalFileStore] Failed to check original file:', err);
    return false;
  }
}

/**
 * Delete original file for a project
 */
export async function deleteOriginalFile(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, projectId);
    console.log(`[OriginalFileStore] Deleted original file for project ${projectId}`);
  } catch (err) {
    console.error('[OriginalFileStore] Failed to delete original file:', err);
  }
}

/**
 * Get all stored project IDs (for debugging/cleanup)
 */
export async function getAllStoredProjectIds(): Promise<string[]> {
  try {
    const db = await getDB();
    return await db.getAllKeys(STORE_NAME) as string[];
  } catch (err) {
    console.error('[OriginalFileStore] Failed to get stored project IDs:', err);
    return [];
  }
}
