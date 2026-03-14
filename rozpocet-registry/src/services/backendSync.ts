/**
 * Backend Sync Service
 * Mirrors localStorage data to PostgreSQL backend (when available).
 *
 * Strategy:
 * - On startup: check backend → load projects → merge with local store
 * - On local changes: debounced push to backend (fire-and-forget)
 * - localStorage remains the primary store (fast, works offline)
 * - PostgreSQL stores a persistent copy (survives browser clear, cross-device)
 */

import { isBackendAvailable, registryAPI } from './registryAPI';
import type { Project, Sheet } from '../types';

let _syncInProgress = false;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 5000;

/**
 * Initial sync: load projects from backend and merge with local store.
 * Returns merged projects array (backend projects that aren't in local store).
 */
export async function loadFromBackend(): Promise<Project[]> {
  const available = await isBackendAvailable();
  if (!available) {
    console.log('[BackendSync] Backend not available — using local storage only');
    return [];
  }

  try {
    const apiProjects = await registryAPI.getProjects();
    if (apiProjects.length === 0) return [];

    // Convert API projects to local Project format
    const backendProjects: Project[] = [];

    for (const ap of apiProjects) {
      try {
        const sheets = await registryAPI.getSheets(ap.project_id);
        const localSheets: Sheet[] = [];

        for (const s of sheets) {
          const items = await registryAPI.getItems(s.sheet_id);
          localSheets.push({
            id: s.sheet_id,
            name: s.sheet_name,
            projectId: ap.project_id,
            items: items.map((i, idx) => ({
              id: i.item_id,
              kod: i.kod || '',
              popis: i.popis || '',
              popisDetail: [],
              popisFull: i.popis || '',
              mnozstvi: i.mnozstvi || 0,
              mj: i.mj || '',
              cenaJednotkova: i.cena_jednotkova ?? null,
              cenaCelkem: i.cena_celkem ?? null,
              skupina: null,
              skupinaSuggested: null,
              source: {
                projectId: ap.project_id,
                fileName: `${ap.project_name}.xlsx`,
                sheetName: s.sheet_name,
                rowStart: i.item_order ?? idx,
                rowEnd: i.item_order ?? idx,
                cellRef: 'A1',
              },
            })),
            stats: {
              totalItems: items.length,
              classifiedItems: 0,
              totalCena: items.reduce((sum, i) => sum + (i.cena_celkem || 0), 0),
            },
            metadata: {
              projectNumber: '',
              projectName: ap.project_name,
              oddil: '',
              stavba: '',
              custom: {},
            },
            config: {
              templateName: 'backend-import',
              columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
              dataStartRow: 1,
              sheetName: s.sheet_name,
              sheetIndex: 0,
              metadataCells: {},
            },
          });
        }

        backendProjects.push({
          id: ap.project_id,
          fileName: `${ap.project_name}.xlsx`,
          projectName: ap.project_name,
          filePath: '',
          importedAt: new Date(ap.created_at),
          sheets: localSheets,
          portalLink: ap.portal_project_id
            ? {
                portalProjectId: ap.portal_project_id,
                linkedAt: new Date(ap.created_at),
                lastSyncedAt: new Date(ap.updated_at),
              }
            : undefined,
        });
      } catch (err) {
        console.warn(`[BackendSync] Failed to load project ${ap.project_id}:`, err);
      }
    }

    console.log(`[BackendSync] Loaded ${backendProjects.length} projects from backend`);
    return backendProjects;
  } catch (err) {
    console.warn('[BackendSync] Failed to load from backend:', err);
    return [];
  }
}

/**
 * Push a single project to the backend (full upsert: project + sheets + items).
 */
export async function pushProjectToBackend(project: Project): Promise<void> {
  if (_syncInProgress) return;

  const available = await isBackendAvailable();
  if (!available) return;

  _syncInProgress = true;
  try {
    // 1. Ensure project exists
    let exists = false;
    try {
      await registryAPI.getProject(project.id);
      exists = true;
    } catch {
      exists = false;
    }

    if (!exists) {
      await registryAPI.createProject(project.projectName, project.portalLink?.portalProjectId, project.id);
    }

    // 2. Get existing sheets from backend
    let existingSheets: Array<{ sheet_id: string }> = [];
    try {
      existingSheets = await registryAPI.getSheets(project.id);
    } catch {
      // Project may have been created with different ID format
    }
    const existingSheetIds = new Set(existingSheets.map(s => s.sheet_id));

    // 3. Sync each sheet + its items
    for (let si = 0; si < project.sheets.length; si++) {
      const sheet = project.sheets[si];

      if (!existingSheetIds.has(sheet.id)) {
        await registryAPI.createSheet(project.id, sheet.name, si, sheet.id);
      }

      // Bulk upsert items
      if (sheet.items.length > 0) {
        const bulkItems = sheet.items.map((item, idx) => ({
          item_id: item.id,
          kod: item.kod || '',
          popis: item.popis || '',
          mnozstvi: item.mnozstvi || 0,
          mj: item.mj || '',
          cena_jednotkova: item.cenaJednotkova ?? undefined,
          cena_celkem: item.cenaCelkem ?? undefined,
          item_order: idx,
        }));
        await registryAPI.bulkCreateItems(sheet.id, bulkItems);
      }
    }

    console.log(`[BackendSync] Full sync: "${project.projectName}" (${project.sheets.length} sheets, ${project.sheets.reduce((s, sh) => s + sh.items.length, 0)} items)`);
  } catch (err) {
    console.warn(`[BackendSync] Failed to push project "${project.projectName}":`, err);
  } finally {
    _syncInProgress = false;
  }
}

/**
 * Debounced sync: push changed projects to backend after a delay.
 */
export function debouncedPushToBackend(project: Project): void {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    pushProjectToBackend(project).catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Merge backend projects into local projects array.
 * Only adds projects that don't already exist locally.
 */
export function mergeProjects(localProjects: Project[], backendProjects: Project[]): Project[] {
  const localIds = new Set(localProjects.map(p => p.id));
  const newFromBackend = backendProjects.filter(p => !localIds.has(p.id));

  if (newFromBackend.length > 0) {
    console.log(`[BackendSync] Adding ${newFromBackend.length} projects from backend to local store`);
  }

  return [...localProjects, ...newFromBackend];
}
