/**
 * Original File Store
 * Stores original Excel files for "return to original" export.
 *
 * Two-tier since 2026-07-08 (cross-device fix):
 *  1. IndexedDB — fast local tier, works offline (as before)
 *  2. registry-backend PostgreSQL — persistent per-user copy, so the
 *     "Vrátit do původního" export works from ANY browser/device, not
 *     only the one where the Excel was originally imported
 *
 * Separate from Zustand store because:
 * 1. ArrayBuffers don't serialize well to JSON
 * 2. Large files should be stored directly in IndexedDB
 * 3. We don't need reactivity for binary data
 */

import { openDB, type IDBPDatabase } from 'idb';
import { registryAPI } from './registryAPI';
import { isPortalLoggedIn } from './portalAuth';

const DB_NAME = 'rozpocet-registry-files';
const DB_VERSION = 1;
const STORE_NAME = 'original-files';

// Backend route accepts 30 MB; stay comfortably under it (and under the
// Cloud Run 32 MB request cap). Larger files stay local-only with a warn.
const MAX_BACKUP_SIZE_BYTES = 25 * 1024 * 1024;

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

/** Local (IndexedDB) tier — never throws, returns null on any failure. */
async function getLocalFile(projectId: string): Promise<OriginalFileData | null> {
  try {
    const db = await getDB();
    const data = await db.get(STORE_NAME, projectId);
    return data || null;
  } catch (err) {
    console.error('[OriginalFileStore] Failed to get original file:', err);
    return null;
  }
}

/** Local (IndexedDB) tier write. Throws — callers decide how to handle. */
async function putLocalFile(projectId: string, fileName: string, fileData: ArrayBuffer): Promise<void> {
  const db = await getDB();
  const data: OriginalFileData = {
    fileName,
    fileData,
    storedAt: new Date(),
  };
  await db.put(STORE_NAME, data, projectId);
}

/**
 * Fire-and-forget backup of the original file to the registry backend.
 * Failures are logged, never thrown — the local tier already has the file
 * and `ensureOriginalFileBackup` retries on the next project open.
 */
function backupToBackend(projectId: string, fileName: string, fileData: ArrayBuffer): void {
  if (!isPortalLoggedIn()) return;
  if (fileData.byteLength > MAX_BACKUP_SIZE_BYTES) {
    console.warn(`[OriginalFileStore] Original file "${fileName}" is ${(fileData.byteLength / 1048576).toFixed(1)} MB > 25 MB — kept local-only, cross-device export unavailable`);
    return;
  }
  registryAPI.uploadOriginalFile(projectId, fileName, fileData)
    .then(() => console.log(`[OriginalFileStore] Backed up original file for project ${projectId} to backend`))
    .catch((err) => console.warn('[OriginalFileStore] Backend backup failed (retries on next project open):', err instanceof Error ? err.message : err));
}

/**
 * Store original file data for a project (local + backend backup)
 */
export async function storeOriginalFile(
  projectId: string,
  fileName: string,
  fileData: ArrayBuffer
): Promise<void> {
  try {
    await putLocalFile(projectId, fileName, fileData);
    console.log(`[OriginalFileStore] Stored original file for project ${projectId}: ${fileName}`);
  } catch (err) {
    console.error('[OriginalFileStore] Failed to store original file:', err);
    // Keep the backend backup attempt even when IndexedDB failed (quota…)
    backupToBackend(projectId, fileName, fileData);
    throw err;
  }
  backupToBackend(projectId, fileName, fileData);
}

/**
 * Get original file data for a project.
 * Local tier first; on miss, pulls the per-user copy from the registry
 * backend (cross-device case) and caches it back into IndexedDB.
 */
export async function getOriginalFile(projectId: string): Promise<OriginalFileData | null> {
  const local = await getLocalFile(projectId);
  if (local) return local;

  if (!isPortalLoggedIn()) return null;
  try {
    const remote = await registryAPI.downloadOriginalFile(projectId);
    if (!remote) return null;
    console.log(`[OriginalFileStore] Restored original file for project ${projectId} from backend (${remote.fileName})`);
    // Cache locally so the next export/reimport is instant — best-effort
    putLocalFile(projectId, remote.fileName, remote.fileData)
      .catch(() => { /* quota/unavailable — remote fallback still works */ });
    return { fileName: remote.fileName, fileData: remote.fileData, storedAt: new Date() };
  } catch (err) {
    console.warn('[OriginalFileStore] Backend original-file fetch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Check if original file exists for a project (local OR backend).
 * The backend check is a lightweight meta probe — no file download.
 */
export async function hasOriginalFile(projectId: string): Promise<boolean> {
  const local = await getLocalFile(projectId);
  if (local) return true;

  if (!isPortalLoggedIn()) return false;
  try {
    const meta = await registryAPI.getOriginalFileMeta(projectId);
    return meta.exists;
  } catch {
    return false;
  }
}

/**
 * Self-healing: if the file exists locally but the backend has no copy
 * (imported before the cross-device feature, or while offline/logged out),
 * upload it now. Cheap when already backed up (one meta probe).
 */
export async function ensureOriginalFileBackup(projectId: string): Promise<void> {
  if (!isPortalLoggedIn()) return;
  const local = await getLocalFile(projectId);
  if (!local) return;
  try {
    const meta = await registryAPI.getOriginalFileMeta(projectId);
    if (meta.exists) return;
  } catch {
    return; // backend unreachable — retry on next project open
  }
  backupToBackend(projectId, local.fileName, local.fileData);
}

/**
 * Delete original file for a project (local tier; the backend copy is
 * removed by the registry_projects ON DELETE CASCADE when the project
 * itself is deleted).
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
