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
// 2026-04-15: reduced from 5000 → 2000 ms. 5s was long enough that
// users closing the tab after an import lost everything. 2s is still
// plenty of debounce for keystroke-level edits but survives quick
// close-tab patterns.
const SYNC_DEBOUNCE_MS = 2000;
/** Pending project to flush on beforeunload. */
let _pendingProject: Project | null = null;

// beforeunload: best-effort synchronous flush. fetch with keepalive lets
// the request survive tab close (browsers allow up to 64 KB). The full
// sheet+items payload is usually larger, so we only flush the project
// header here and rely on the next session load to re-push the rest.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (_pendingProject) {
      // Fire keepalive POST directly — skip pushProjectToBackend because
      // it's async and won't complete before the tab dies.
      try {
        const p = _pendingProject;
        const url = `${(import.meta as any).env?.VITE_REGISTRY_API_URL
          || 'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app'}/api/registry/projects`;
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            project_id: p.id,
            project_name: p.projectName,
            portal_project_id: p.portalLink?.portalProjectId,
            user_id: 1,
          }),
        }).catch(() => {});
      } catch {
        // ignore
      }
    }
  });
}

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
              skupina: i.skupina || null,
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
    // 1. UPSERT project (backend's POST has ON CONFLICT DO UPDATE).
    //    Previously we did a GET first to "check exists" and ignored
    //    the 404 — but that 404 surfaced in browser console as scary
    //    noise and confused users into thinking the backend was down.
    //    POST is idempotent and already the right call.
    await registryAPI.createProject(
      project.projectName,
      project.portalLink?.portalProjectId,
      project.id,
    );

    // 2. Sync each sheet + its items. The sheet POST endpoint is also
    //    UPSERT (ON CONFLICT DO UPDATE on sheet_id), so we can skip the
    //    "fetch existing sheets" pre-check too.
    for (let si = 0; si < project.sheets.length; si++) {
      const sheet = project.sheets[si];

      await registryAPI.createSheet(project.id, sheet.name, si, sheet.id);

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
          skupina: item.skupina || undefined,
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
 * Also arms the beforeunload fallback with the latest snapshot so a
 * quick close-tab doesn't lose the project header.
 */
export function debouncedPushToBackend(project: Project): void {
  _pendingProject = project;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    pushProjectToBackend(project)
      .then(() => { _pendingProject = null; })
      .catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Delete a project from the backend (fire-and-forget).
 */
export async function deleteProjectFromBackend(projectId: string): Promise<void> {
  const available = await isBackendAvailable();
  if (!available) return;

  try {
    await registryAPI.deleteProject(projectId);
    console.log(`[BackendSync] Deleted project ${projectId} from backend`);
  } catch (err) {
    console.warn(`[BackendSync] Failed to delete project ${projectId} from backend:`, err);
  }
}

/**
 * Delete all projects from the backend (fire-and-forget).
 */
export async function deleteAllProjectsFromBackend(): Promise<void> {
  const available = await isBackendAvailable();
  if (!available) return;

  try {
    const apiProjects = await registryAPI.getProjects();
    for (const ap of apiProjects) {
      try {
        await registryAPI.deleteProject(ap.project_id);
      } catch {
        // Continue deleting others
      }
    }
    console.log(`[BackendSync] Deleted ${apiProjects.length} projects from backend`);
  } catch (err) {
    console.warn('[BackendSync] Failed to delete all projects from backend:', err);
  }
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
