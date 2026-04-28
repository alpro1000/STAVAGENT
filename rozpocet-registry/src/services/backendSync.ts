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
import { tombstoneProject, isTombstoned, dropTombstoned, forgetTombstone } from './tombstoneStore';
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

// ─── Phase 3 (2026-04-15): sync status pub/sub ─────────────────────────────
//
// Exposes a tiny event-emitter so the UI can render a badge showing:
//   'idle'       — everything synced, backend unreachable not detected
//   'pending'    — debounce timer armed, waiting to push
//   'syncing'    — POST in flight
//   'synced'     — last push succeeded (sticks for 3 s then → 'idle')
//   'error'      — last push threw (sticks until next push)
//   'offline'    — isBackendAvailable() returned false on last check
//
// The `backendSyncStatus` module-level variable is the single source of
// truth. `subscribeBackendSync(cb)` returns an unsubscribe fn; callers
// get the current status immediately (pull) plus push notifications.

export type BackendSyncStatus =
  | 'idle'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline';

interface BackendSyncState {
  status: BackendSyncStatus;
  lastError: string | null;
  lastSyncedAt: number | null;  // unix ms
  pendingProjectName: string | null;
}

let _state: BackendSyncState = {
  status: 'idle',
  lastError: null,
  lastSyncedAt: null,
  pendingProjectName: null,
};

type Listener = (state: BackendSyncState) => void;
const _listeners = new Set<Listener>();

function setState(patch: Partial<BackendSyncState>): void {
  _state = { ..._state, ...patch };
  for (const l of _listeners) {
    try { l(_state); } catch { /* ignore listener errors */ }
  }
}

export function getBackendSyncState(): BackendSyncState {
  return _state;
}

export function subscribeBackendSync(cb: Listener): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

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
    setState({ status: 'offline' });
    return [];
  }

  try {
    const apiProjectsRaw = await registryAPI.getProjects();
    // Drop projects the user has deleted locally — without this filter
    // a backend DELETE that timed out (or was never received) lets the
    // project re-appear on the next loadFromBackend, silently undoing
    // the user's delete. Tombstones are cleared by a successful DELETE
    // round-trip in `deleteProjectFromBackend`.
    const apiProjects = dropTombstoned(apiProjectsRaw);
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

  // Race guard: a debounced push that fired BEFORE the user clicked
  // delete (or fires after delete because Zustand re-emitted the
  // previous snapshot) would re-create the project on the backend.
  // The tombstone outranks any pending push — skip silently.
  if (isTombstoned(project.id)) {
    console.log(`[BackendSync] Skip push for tombstoned project "${project.projectName}" (${project.id})`);
    return;
  }

  const available = await isBackendAvailable();
  if (!available) {
    setState({ status: 'offline', lastError: 'Backend unreachable' });
    return;
  }

  _syncInProgress = true;
  setState({ status: 'syncing', pendingProjectName: project.projectName });
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
    setState({
      status: 'synced',
      lastError: null,
      lastSyncedAt: Date.now(),
      pendingProjectName: null,
    });
    // Auto-fade the "synced" badge back to idle after 3 s so the UI
    // doesn't get stuck showing a stale "just now" indicator.
    setTimeout(() => {
      if (_state.status === 'synced') setState({ status: 'idle' });
    }, 3000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[BackendSync] Failed to push project "${project.projectName}":`, err);
    setState({ status: 'error', lastError: msg });
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
  // Phase 3: flip status to 'pending' so the UI shows "Čeká se na uložení…"
  // while the debounce timer is armed. Don't clobber 'syncing' / 'error'
  // states (a retry will reset them correctly on next push).
  if (_state.status !== 'syncing' && _state.status !== 'offline') {
    setState({ status: 'pending', pendingProjectName: project.projectName });
  }
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
  // Tombstone IMMEDIATELY (sync, persisted to localStorage) so the
  // next loadFromBackend filters this id out even if the DELETE
  // below times out / 5xx / never reaches the backend. Without this
  // the user's delete silently un-deletes on next reload.
  tombstoneProject(projectId);

  const available = await isBackendAvailable();
  if (!available) return;

  try {
    await registryAPI.deleteProject(projectId);
    console.log(`[BackendSync] Deleted project ${projectId} from backend`);
    // Backend confirmed delete → clear the tombstone so the local
    // store no longer needs to filter against this id.
    forgetTombstone(projectId);
  } catch (err) {
    // DELETE failed — keep the tombstone so the project doesn't
    // re-appear on the next loadFromBackend. Worst case: the
    // tombstone outlives the backend record. Acceptable trade-off.
    console.warn(`[BackendSync] Failed to delete project ${projectId} from backend (tombstoned locally):`, err);
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
