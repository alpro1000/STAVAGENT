/**
 * Tombstone store — tracks IDs of projects the user has deleted
 * locally so `loadFromBackend()` can filter them out even if the
 * backend hasn't actually processed the DELETE yet.
 *
 * Background: `deleteProjectFromBackend` is fire-and-forget and
 * uses `fetchWithTimeout(8s)`. On Cloud Run cold-starts the DELETE
 * frequently times out with `AbortError`, the project stays in
 * Postgres, and on the next `loadFromBackend` it gets re-added to
 * the local store — silently undoing the user's delete.
 *
 * The tombstone is the source of truth for "user wanted this gone":
 *   - On delete, write the id to localStorage immediately.
 *   - On every `loadFromBackend` result, filter out tombstoned ids
 *     before adding them to the store.
 *   - On a successful DELETE response (or 404 = already gone),
 *     `forgetTombstone(id)` clears it — frees up that id slot in
 *     case the user later imports a new project with the same id
 *     (extremely unlikely, but defensive).
 *
 * Tombstones never expire automatically; the only way to remove
 * them is a successful DELETE response. Worst case (backend
 * permanently broken), the localStorage Set grows by one per
 * deleted project — negligible storage.
 */

const LS_KEY = 'registry-tombstoned-project-ids';

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Quota / storage disabled — best effort, the tombstone protects
    // against backend-replay; without it we degrade to today's bug
    // (project comes back), not worse.
  }
}

/** Mark a project ID as deleted-by-user. Persists immediately. */
export function tombstoneProject(projectId: string): void {
  const set = readSet();
  if (set.has(projectId)) return;
  set.add(projectId);
  writeSet(set);
}

/** Check whether a project ID has been tombstoned. */
export function isTombstoned(projectId: string): boolean {
  return readSet().has(projectId);
}

/** Filter helper: drop tombstoned projects from a list (used by
 *  `loadFromBackend` to never re-import what the user deleted). */
export function dropTombstoned<T extends { id: string } | { project_id: string }>(items: T[]): T[] {
  const set = readSet();
  if (set.size === 0) return items;
  return items.filter((it) => {
    const id = 'id' in it ? it.id : it.project_id;
    return !set.has(id);
  });
}

/** Clear a tombstone — call after a successful DELETE response. */
export function forgetTombstone(projectId: string): void {
  const set = readSet();
  if (!set.delete(projectId)) return;
  writeSet(set);
}

/** Read-only snapshot for diagnostics / tests. */
export function listTombstones(): string[] {
  return Array.from(readSet());
}
