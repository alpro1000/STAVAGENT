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
import { isPortalLoggedIn, portalAuthHeader } from './portalAuth';
import { tombstoneProject, isTombstoned, dropTombstoned, forgetTombstone } from './tombstoneStore';
import {
  serializeClassification,
  deserializeClassification,
  applyClassificationBlob,
} from './classificationCodec';
import type { Project, Sheet, ParsedItem } from '../types';

let _syncInProgress = false;
// Per-project debounce timers. A single shared timer meant the last-edited
// project silently cancelled the pending push of every other project.
const _syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
// 2026-04-15: reduced from 5000 → 2000 ms. 5s was long enough that
// users closing the tab after an import lost everything. 2s is still
// plenty of debounce for keystroke-level edits but survives quick
// close-tab patterns.
const SYNC_DEBOUNCE_MS = 2000;
/** Pending projects to flush on beforeunload (latest snapshot per id). */
const _pendingProjects = new Map<string, Project>();

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
    for (const p of _pendingProjects.values()) {
      // Tombstone outranks the flush — the backend POST is an UPSERT, so
      // flushing a just-deleted project's header on tab close would
      // resurrect it (pushProjectToBackend has this guard; mirror it here).
      if (isTombstoned(p.id)) continue;
      // Fire keepalive POST directly — skip pushProjectToBackend because
      // it's async and won't complete before the tab dies.
      try {
        const url = `${(import.meta as any).env?.VITE_REGISTRY_API_URL
          || 'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app'}/api/registry/projects`;
        fetch(url, {
          method: 'POST',
          // Backend derives owner_id from the JWT — without the Bearer
          // header this keepalive flush 401s and saves nothing.
          headers: { 'Content-Type': 'application/json', ...portalAuthHeader() },
          keepalive: true,
          body: JSON.stringify({
            project_id: p.id,
            project_name: p.projectName,
            portal_project_id: p.portalLink?.portalProjectId,
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
  // Backend routes require a Portal JWT — without the cross-subdomain
  // cookie every call 401s, so be honest up front instead of surfacing
  // a generic sync error.
  if (!isPortalLoggedIn()) {
    console.log('[BackendSync] Not logged in to Portal — data stays in this browser only');
    setState({ status: 'offline', lastError: 'Nepřihlášen do Portálu — data pouze v tomto prohlížeči' });
    return [];
  }

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
            items: items.map((i, idx) => {
              const item: ParsedItem = {
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
              };
              // Restore classifier output from sync_metadata. Legacy items
              // pre-classifier-rewrite have no blob and stay as a flat list
              // with rowRole/parentItemId/sectionId undefined — the UI
              // already handles that case via per-row defaults.
              applyClassificationBlob(item, deserializeClassification(i.sync_metadata));
              // popisFull was reconstructed above from `popis` only — if
              // the blob restored detail lines, append them to keep the
              // search-index column consistent with the rendered text.
              if (item.popisDetail && item.popisDetail.length > 0) {
                item.popisFull = [item.popis, ...item.popisDetail].filter(Boolean).join('\n');
              }
              return item;
            }),
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
 * Push one sheet (UPSERT sheet row + bulk-UPSERT its items) with a single
 * retry after a short pause — Cloud Run cold-start timeouts are transient
 * and used to abort the WHOLE multi-sheet push mid-way, leaving a partial
 * backend copy (e.g. 28 of 68 sheets) that never completed.
 */
const SHEET_RETRY_DELAY_MS = 2000;

async function pushSheetToBackend(projectId: string, sheet: Sheet, order: number): Promise<void> {
  // Pack the row-classifier output (rowRole, parentItemId, sectionId,
  // _rawCells, popisDetail, originalTyp, …) into the `sync_metadata`
  // JSON column so a localStorage wipe or cross-device load can
  // reconstruct hierarchy on the next pull.
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
    sync_metadata: serializeClassification(item) ?? undefined,
  }));

  const attempt = async () => {
    // Both endpoints are UPSERTs (ON CONFLICT DO UPDATE), so a retry
    // re-running the sheet POST after a mid-flight abort is safe.
    await registryAPI.createSheet(projectId, sheet.name, order, sheet.id);
    if (bulkItems.length > 0) {
      await registryAPI.bulkCreateItems(sheet.id, bulkItems);
    }
  };

  try {
    await attempt();
  } catch {
    await new Promise((r) => setTimeout(r, SHEET_RETRY_DELAY_MS));
    await attempt();
  }
}

/**
 * Push a single project to the backend (full upsert: project + sheets + items).
 */
export async function pushProjectToBackend(project: Project): Promise<void> {
  if (_syncInProgress) {
    // A push is already in flight — re-arm instead of silently dropping
    // this project's changes (the old early-return lost them until the
    // next unrelated edit).
    debouncedPushToBackend(project);
    return;
  }

  // Race guard: a debounced push that fired BEFORE the user clicked
  // delete (or fires after delete because Zustand re-emitted the
  // previous snapshot) would re-create the project on the backend.
  // The tombstone outranks any pending push — skip silently.
  if (isTombstoned(project.id)) {
    console.log(`[BackendSync] Skip push for tombstoned project "${project.projectName}" (${project.id})`);
    return;
  }

  // No Portal JWT → the backend would 401 every request. Honest status
  // instead of a scary error; sync resumes automatically once the user
  // logs in to Portal (cookie appears) and the next change fires.
  if (!isPortalLoggedIn()) {
    setState({ status: 'offline', lastError: 'Nepřihlášen do Portálu — data pouze v tomto prohlížeči' });
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

    // 2. Sync each sheet + its items, tolerating per-sheet failures.
    //    One timeout used to throw out of this loop and silently drop
    //    every remaining sheet — the backend then held a partial copy
    //    forever. Now: retry once per sheet, keep going, and report
    //    partial success honestly.
    const failedSheets: string[] = [];
    for (let si = 0; si < project.sheets.length; si++) {
      const sheet = project.sheets[si];
      try {
        await pushSheetToBackend(project.id, sheet, si);
      } catch (err) {
        failedSheets.push(sheet.name);
        console.warn(`[BackendSync] Sheet "${sheet.name}" failed after retry:`, err);
      }
    }

    if (failedSheets.length > 0) {
      const okCount = project.sheets.length - failedSheets.length;
      const msg = `Uloženo částečně: ${okCount}/${project.sheets.length} listů — zbytek se doplní při další změně nebo příštím načtení`;
      console.warn(`[BackendSync] Partial sync of "${project.projectName}": ${msg} (failed: ${failedSheets.join(', ')})`);
      setState({ status: 'error', lastError: msg, pendingProjectName: null });
      return;
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
  _pendingProjects.set(project.id, project);
  // Phase 3: flip status to 'pending' so the UI shows "Čeká se na uložení…"
  // while the debounce timer is armed. Don't clobber 'syncing' / 'error'
  // states (a retry will reset them correctly on next push).
  if (_state.status !== 'syncing' && _state.status !== 'offline') {
    setState({ status: 'pending', pendingProjectName: project.projectName });
  }
  const existing = _syncTimers.get(project.id);
  if (existing) clearTimeout(existing);
  _syncTimers.set(project.id, setTimeout(() => {
    _syncTimers.delete(project.id);
    pushProjectToBackend(project)
      .then(() => {
        // Clear only if no newer snapshot got queued meanwhile
        if (_pendingProjects.get(project.id) === project) {
          _pendingProjects.delete(project.id);
        }
      })
      .catch(() => {});
  }, SYNC_DEBOUNCE_MS));
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
