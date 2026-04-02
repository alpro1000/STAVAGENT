/**
 * Hook that wraps registry store mutations with undo/redo tracking.
 *
 * Usage: replace direct store calls with these wrapped versions.
 * Each mutation snapshots old values before applying, pushes to undo stack.
 */

import { useCallback } from 'react';
import { useRegistryStore } from '../stores/registryStore';
import { useUndoStore, MAX_UNDO, type UndoEntry, type UndoChange } from '../stores/undoStore';
import type { ParsedItem } from '../types/item';

/** Helper: find items in current sheet */
function getSheetItems(
  projectId: string,
  sheetId: string,
): ParsedItem[] {
  const project = useRegistryStore.getState().projects.find(p => p.id === projectId);
  const sheet = project?.sheets.find(s => s.id === sheetId);
  return sheet?.items ?? [];
}

export function useUndoableActions(projectId: string, sheetId: string) {
  const store = useRegistryStore();
  const { pushUndo } = useUndoStore();

  /** Undo: apply oldValue for each change */
  const applyUndo = useCallback((entry: UndoEntry) => {
    const items = getSheetItems(projectId, sheetId);
    for (const change of entry.changes) {
      const item = items.find(i => i.id === change.itemId);
      if (!item) continue;

      if (change.field === 'skupina') {
        // Use direct store set to avoid cascade logic (we recorded all affected items)
        useRegistryStore.getState().bulkSetSkupina(projectId, sheetId, [
          // We can't use bulkSetSkupina because it re-cascades.
          // Instead, patch items directly via setItems approach below.
        ]);
        // Break out - we'll batch apply below
        break;
      }
      if (change.field === 'rowRole') {
        store.updateItemRole(projectId, sheetId, change.itemId, change.oldValue as ParsedItem['rowRole'] ?? 'unknown');
      }
    }

    // For skupina changes, batch-apply all old values at once via direct item patching
    const skupinaChanges = entry.changes.filter(c => c.field === 'skupina');
    if (skupinaChanges.length > 0) {
      patchItems(projectId, sheetId, skupinaChanges.map(c => ({
        itemId: c.itemId,
        field: 'skupina',
        value: c.oldValue,
      })));
    }
  }, [projectId, sheetId, store]);

  /** Redo: apply newValue for each change */
  const applyRedo = useCallback((entry: UndoEntry) => {
    const skupinaChanges = entry.changes.filter(c => c.field === 'skupina');
    const roleChanges = entry.changes.filter(c => c.field === 'rowRole');

    if (skupinaChanges.length > 0) {
      patchItems(projectId, sheetId, skupinaChanges.map(c => ({
        itemId: c.itemId,
        field: 'skupina',
        value: c.newValue,
      })));
    }

    for (const change of roleChanges) {
      store.updateItemRole(projectId, sheetId, change.itemId, change.newValue as ParsedItem['rowRole'] ?? 'unknown');
    }
  }, [projectId, sheetId, store]);

  /** Perform undo */
  const undo = useCallback(() => {
    const entry = useUndoStore.getState().popUndo();
    if (!entry) return;
    applyUndo(entry);
    useUndoStore.getState().pushRedo(entry);
  }, [applyUndo]);

  /** Perform redo */
  const redo = useCallback(() => {
    const entry = useUndoStore.getState().popRedo();
    if (!entry) return;
    applyRedo(entry);
    // Push back to undo without clearing redo (manual push)
    useUndoStore.setState((s) => {
      const stack = [...s.undoStack, entry];
      if (stack.length > MAX_UNDO) stack.shift();
      return { undoStack: stack };
    });
  }, [applyRedo]);

  // --- Wrapped mutations ---

  /** Set skupina on one item (with cascade tracking) */
  const setItemSkupinaUndoable = useCallback((itemId: string, skupina: string | null, description?: string) => {
    const items = getSheetItems(projectId, sheetId);
    // Snapshot current skupiny for ALL items (cascade may affect subordinates)
    const before = new Map(items.map(i => [i.id, i.skupina]));

    // Apply via store (which handles cascade)
    store.setItemSkupina(projectId, sheetId, itemId, skupina as string);

    // Compare after
    const after = getSheetItems(projectId, sheetId);
    const changes: UndoChange[] = [];
    for (const item of after) {
      const old = before.get(item.id);
      if (old !== item.skupina) {
        changes.push({ itemId: item.id, field: 'skupina', oldValue: old ?? null, newValue: item.skupina });
      }
    }

    if (changes.length > 0) {
      const desc = description ?? (
        skupina
          ? `Skupina → ${skupina}${changes.length > 1 ? ` (${changes.length} položek)` : ''}`
          : `Skupina vymazána${changes.length > 1 ? ` (${changes.length} položek)` : ''}`
      );
      pushUndo({
        action: skupina ? 'set_skupina' : 'clear_skupina',
        description: desc,
        changes,
      });
    }
  }, [projectId, sheetId, store, pushUndo]);

  /** Bulk set skupina (AI classify, bulk bar, etc.) */
  const bulkSetSkupinaUndoable = useCallback((
    updates: Array<{ itemId: string; skupina: string }>,
    description?: string,
    action?: string,
  ) => {
    const items = getSheetItems(projectId, sheetId);
    const before = new Map(items.map(i => [i.id, i.skupina]));

    store.bulkSetSkupina(projectId, sheetId, updates);

    const after = getSheetItems(projectId, sheetId);
    const changes: UndoChange[] = [];
    for (const item of after) {
      const old = before.get(item.id);
      if (old !== item.skupina) {
        changes.push({ itemId: item.id, field: 'skupina', oldValue: old ?? null, newValue: item.skupina });
      }
    }

    if (changes.length > 0) {
      pushUndo({
        action: action ?? 'bulk_skupina',
        description: description ?? `Skupina pro ${changes.length} položek`,
        changes,
      });
    }
  }, [projectId, sheetId, store, pushUndo]);

  /** Clear all skupiny in sheet */
  const clearSheetSkupinyUndoable = useCallback((description?: string) => {
    const items = getSheetItems(projectId, sheetId);
    const changes: UndoChange[] = items
      .filter(i => i.skupina)
      .map(i => ({ itemId: i.id, field: 'skupina', oldValue: i.skupina, newValue: null }));

    store.clearSheetSkupiny(projectId, sheetId);

    if (changes.length > 0) {
      pushUndo({
        action: 'clear_skupina',
        description: description ?? `Skupiny vymazány (${changes.length} položek)`,
        changes,
      });
    }
  }, [projectId, sheetId, store, pushUndo]);

  /** Change row role */
  const updateItemRoleUndoable = useCallback((itemId: string, newRole: 'main' | 'subordinate' | 'section' | 'unknown') => {
    const items = getSheetItems(projectId, sheetId);
    const item = items.find(i => i.id === itemId);
    const oldRole = item?.rowRole ?? 'unknown';

    store.updateItemRole(projectId, sheetId, itemId, newRole);

    const LABELS: Record<string, string> = { main: 'Hlavní', subordinate: 'Podřízený', section: 'Sekce', unknown: 'Neznámý' };
    pushUndo({
      action: 'set_role',
      description: `Role: ${LABELS[oldRole]} → ${LABELS[newRole]}`,
      changes: [{ itemId, field: 'rowRole', oldValue: oldRole, newValue: newRole }],
    });
  }, [projectId, sheetId, store, pushUndo]);

  /** Apply skupina globally (all sheets) — tracked only for current sheet */
  const setItemSkupinaGlobalUndoable = useCallback((itemKod: string, skupina: string) => {
    // Snapshot ALL projects/sheets before
    const allProjects = useRegistryStore.getState().projects;
    const beforeMap = new Map<string, Map<string, string | null>>();
    for (const p of allProjects) {
      for (const s of p.sheets) {
        const itemMap = new Map(s.items.map(i => [i.id, i.skupina ?? null]));
        beforeMap.set(`${p.id}:${s.id}`, itemMap);
      }
    }

    store.setItemSkupinaGlobal(itemKod, skupina);

    // Collect changes across all sheets
    const afterProjects = useRegistryStore.getState().projects;
    const changes: UndoChange[] = [];
    for (const p of afterProjects) {
      for (const s of p.sheets) {
        const key = `${p.id}:${s.id}`;
        const oldMap = beforeMap.get(key);
        if (!oldMap) continue;
        for (const item of s.items) {
          const old = oldMap.get(item.id);
          if (old !== (item.skupina ?? null)) {
            changes.push({ itemId: item.id, field: 'skupina', oldValue: old, newValue: item.skupina });
          }
        }
      }
    }

    if (changes.length > 0) {
      pushUndo({
        action: 'bulk_skupina',
        description: `Skupina → ${skupina} pro kód ${itemKod} (${changes.length} položek, všechny listy)`,
        changes,
      });
    }
  }, [store, pushUndo]);

  return {
    undo,
    redo,
    setItemSkupinaUndoable,
    bulkSetSkupinaUndoable,
    clearSheetSkupinyUndoable,
    updateItemRoleUndoable,
    setItemSkupinaGlobalUndoable,
  };
}

/**
 * Directly patch item fields without cascade logic.
 * Used by undo/redo to restore exact previous state.
 */
function patchItems(
  projectId: string,
  sheetId: string,
  patches: Array<{ itemId: string; field: string; value: unknown }>,
) {
  const patchMap = new Map(patches.map(p => [p.itemId, p]));

  useRegistryStore.setState((state) => ({
    projects: state.projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        sheets: p.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          return {
            ...sheet,
            items: sheet.items.map((item) => {
              const patch = patchMap.get(item.id);
              if (!patch) return item;
              return { ...item, [patch.field]: patch.value };
            }),
          };
        }),
      };
    }),
  }));

  // Update stats
  useRegistryStore.getState().updateSheetStats(projectId, sheetId);
}
