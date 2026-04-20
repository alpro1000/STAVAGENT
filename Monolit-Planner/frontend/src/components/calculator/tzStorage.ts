/**
 * Per-element TZ persistence (Task 3, 2026-04-20).
 *
 * When the calculator is opened from Monolit Planner with a `position_id`
 * URL param, the user's pasted TZ text + apply history persist across
 * sessions under `planner-tz:{position_id}`. Standalone calculator
 * (no position_id) falls back to the legacy session-only
 * `planner-tz-text` key — no per-element identity to key by.
 *
 * Storage schema (JSON blob under the per-position key):
 *   {
 *     text: string,
 *     lastAppliedAt?: ISO 8601 timestamp,
 *     appliedCount?: number,
 *     history: HistoryEntry[],   // most-recent-last, capped at MAX_HISTORY
 *     version: 1,
 *   }
 *
 * History entries summarise each Apply click so the user can audit what
 * flowed from TZ → form at each step. Not a full undo log.
 */

// Tunables
export const LEGACY_TZ_KEY = 'planner-tz-text';
/** Max text length (ČSN EN + TKP + geology fits comfortably under 50 KB). */
export const TZ_MAX_CHARS = 50_000;
/** How many history entries to retain per position. */
export const TZ_MAX_HISTORY = 5;

/** Apply methods surfaced in history. */
export type TzApplyMethod = 'doplnit' | 'prepsat';

export interface TzHistoryEntry {
  /** ISO 8601 timestamp the apply happened. */
  ts: string;
  /** Which mode the user was in when they clicked the button. */
  method: TzApplyMethod;
  /** Field names actually written to the form this apply. */
  added: string[];
  /** Field names found in TZ but preserved (already filled by user). */
  kept: string[];
  /** Field names with ambiguous TZ values — user had to resolve. */
  conflicts: string[];
  /** Field names rejected as incompatible / locked. */
  ignored: string[];
}

export interface TzBlob {
  text: string;
  lastAppliedAt?: string;
  appliedCount?: number;
  history: TzHistoryEntry[];
  version: 1;
}

/** Compose LS key for a specific Monolit Planner position. */
function keyForPosition(position_id: string): string {
  return `planner-tz:${position_id}`;
}

/** Safe LS read — returns `null` when unavailable or JSON invalid. */
function safeRead(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Safe LS write — swallows quota / private-mode errors. */
function safeWrite(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Load ─────────────────────────────────────────────────────────────────

/**
 * Read the persisted TZ blob for a position (or `null` when nothing saved).
 * Falls back to legacy session-only `planner-tz-text` for standalone
 * calculator launches — that key is NEVER written back with an element
 * identity, so it can't leak between positions.
 */
export function loadTzBlob(position_id: string | null | undefined): TzBlob | null {
  if (position_id) {
    const raw = safeRead(keyForPosition(position_id));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.text === 'string') {
        return {
          text: parsed.text,
          lastAppliedAt: typeof parsed.lastAppliedAt === 'string' ? parsed.lastAppliedAt : undefined,
          appliedCount: typeof parsed.appliedCount === 'number' ? parsed.appliedCount : undefined,
          history: Array.isArray(parsed.history) ? parsed.history.slice(0, TZ_MAX_HISTORY) : [],
          version: 1,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
  // Standalone — legacy session-only key, text-only.
  const legacy = safeRead(LEGACY_TZ_KEY);
  if (!legacy) return null;
  return { text: legacy, history: [], version: 1 };
}

// ─── Save ─────────────────────────────────────────────────────────────────

/**
 * Persist the TZ text for a position. Truncates to `TZ_MAX_CHARS`. Leaves
 * history untouched — call `appendTzHistory` separately for that.
 *
 * When `position_id` is falsy, writes to the legacy session-only key.
 */
export function saveTzText(position_id: string | null | undefined, text: string): void {
  const trimmed = text.length > TZ_MAX_CHARS ? text.slice(0, TZ_MAX_CHARS) : text;
  if (position_id) {
    const existing = loadTzBlob(position_id) ?? { text: '', history: [], version: 1 as const };
    const next: TzBlob = { ...existing, text: trimmed };
    if (trimmed === '') {
      // Empty text + no history → drop the record entirely to keep LS tidy.
      if (next.history.length === 0) {
        safeRemove(keyForPosition(position_id));
        return;
      }
    }
    safeWrite(keyForPosition(position_id), JSON.stringify(next));
    return;
  }
  // Standalone — legacy key, plain string.
  if (trimmed === '') safeRemove(LEGACY_TZ_KEY);
  else safeWrite(LEGACY_TZ_KEY, trimmed);
}

/**
 * Append a new apply-event entry to the position's history ring buffer.
 * Also stamps `lastAppliedAt` + bumps `appliedCount`. Silently does
 * nothing for standalone launches (no position_id) because session-only
 * history would be lost on refresh anyway.
 */
export function appendTzHistory(
  position_id: string | null | undefined,
  entry: Omit<TzHistoryEntry, 'ts'> & { ts?: string },
): void {
  if (!position_id) return;
  const existing = loadTzBlob(position_id) ?? { text: '', history: [], version: 1 as const };
  const fullEntry: TzHistoryEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    method: entry.method,
    added: entry.added,
    kept: entry.kept,
    conflicts: entry.conflicts,
    ignored: entry.ignored,
  };
  // Newest last; cap at MAX_HISTORY by dropping oldest.
  const history = [...existing.history, fullEntry].slice(-TZ_MAX_HISTORY);
  const next: TzBlob = {
    ...existing,
    lastAppliedAt: fullEntry.ts,
    appliedCount: (existing.appliedCount ?? 0) + 1,
    history,
  };
  safeWrite(keyForPosition(position_id), JSON.stringify(next));
}

// ─── Clear ────────────────────────────────────────────────────────────────

/**
 * Remove the entire TZ blob for a position (text + history). Use from a
 * confirm dialog in the UI. Standalone falls back to the legacy key.
 */
export function clearTzBlob(position_id: string | null | undefined): void {
  if (position_id) safeRemove(keyForPosition(position_id));
  else safeRemove(LEGACY_TZ_KEY);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Array-aware "is field empty" check. Merged from Task 1's inline helper +
 * Task 2 arrays: `string[]` with length 0 counts as empty (exposure_classes
 * default). Used by the Doplnit (merge) apply mode to decide whether to
 * skip a field.
 */
export function isFieldEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return value === 0 || Number.isNaN(value);
  if (typeof value === 'boolean') return value === false;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Produce a short Czech summary of a history entry for the panel. */
export function formatTzHistoryLine(h: TzHistoryEntry): string {
  const parts: string[] = [];
  if (h.added.length) parts.push(`Přidáno ${h.added.length}`);
  if (h.kept.length) parts.push(`Zachováno ${h.kept.length}`);
  if (h.conflicts.length) parts.push(`Konflikt ${h.conflicts.length}`);
  if (h.ignored.length) parts.push(`Ignorováno ${h.ignored.length}`);
  return parts.join(' · ') || 'Žádné změny';
}
